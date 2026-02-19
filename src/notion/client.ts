/**
 * Shared Notion API client using raw HTTP for reliability
 */
import { cached, invalidate } from './cache';

// ─── Config ──────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Required environment variable ${name} is not set.`);
    }
    return value;
}

const NOTION_TOKEN: string = requireEnv('NOTION_TOKEN');
const NOTION_TASKS_DB: string = requireEnv('NOTION_TASKS_DB');
const NOTION_PROJECTS_DB: string = requireEnv('NOTION_PROJECTS_DB');
const NOTION_GOALS_DB: string = requireEnv('NOTION_GOALS_DB');

const HEADERS: Record<string, string> = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
};

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single Notion property value — the API returns varying shapes per type. */
export interface NotionPropertyValue {
    type: string;
    id?: string;
    title?: Array<{ plain_text: string }>;
    rich_text?: Array<{ plain_text: string }>;
    status?: { name: string };
    select?: { name: string };
    relation?: Array<{ id: string }>;
    date?: { start: string; end: string | null };
    checkbox?: boolean;
    number?: number | null;
    formula?: { type: string; string?: string; number?: number; boolean?: boolean };
}

export interface NotionPage {
    id: string;
    url: string;
    object?: string;
    archived?: boolean;
    created_time: string;
    last_edited_time: string;
    properties: Record<string, NotionPropertyValue>;
}

export interface NotionQueryResponse {
    results: NotionPage[];
    next_cursor: string | null;
    has_more: boolean;
}

/** Shape expected by queryDatabaseFiltered's `sorts` parameter. */
export interface NotionSort {
    property: string;
    direction: 'ascending' | 'descending';
}

/** Notion filter object — intentionally loose since the filter DSL is large. */
export type NotionFilter = Record<string, unknown>;

// ─── Core HTTP helpers ────────────────────────────────────────────────────────

async function notionFetch(url: string, options: RequestInit & { timeoutMs?: number }): Promise<Response> {
    const { timeoutMs = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timeout);
    }
}

async function paginatedQuery(databaseId: string, body: Record<string, unknown>): Promise<NotionPage[]> {
    const results: NotionPage[] = [];
    let nextCursor: string | null = null;

    do {
        const pageBody = { ...body, page_size: 100, ...(nextCursor ? { start_cursor: nextCursor } : {}) };
        const res = await notionFetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(pageBody),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Notion query failed: ${res.status} ${text}`);
        }

        const json = await res.json() as NotionQueryResponse;
        results.push(...json.results);
        nextCursor = json.has_more ? json.next_cursor : null;
    } while (nextCursor);

    return results;
}

// ─── Public query functions ───────────────────────────────────────────────────

/**
 * Query a Notion database with full pagination.
 */
export async function queryDatabase(databaseId: string): Promise<NotionPage[]> {
    return paginatedQuery(databaseId, {});
}

/**
 * Query a Notion database with optional filter and sorts.
 */
export async function queryDatabaseFiltered(
    databaseId: string,
    filter?: NotionFilter,
    sorts?: NotionSort[],
    pageSize: number = 100,
): Promise<NotionPage[]> {
    const body: Record<string, unknown> = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    return paginatedQuery(databaseId, body);
}

/**
 * Create a new page in a Notion database.
 * Invalidates the relevant cache key automatically.
 */
export async function createPage(
    databaseId: string,
    properties: Record<string, NotionPropertyValue | { title: Array<{ text: { content: string } }> }>,
): Promise<NotionPage> {
    const res = await notionFetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
        timeoutMs: 10000,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Create page failed: ${res.status} ${text}`);
    }

    // Invalidate the cache for whichever DB was written to
    invalidateDatabaseCache(databaseId);
    return await res.json() as NotionPage;
}

/**
 * Update an existing Notion page's properties.
 * Invalidates the relevant cache key automatically.
 */
export async function updatePage(
    pageId: string,
    properties: Record<string, NotionPropertyValue | null>,
): Promise<NotionPage> {
    const res = await notionFetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ properties }),
        timeoutMs: 10000,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Update page failed: ${res.status} ${text}`);
    }

    // Invalidate all DB caches since we don't know which DB this page belongs to
    invalidate();
    return await res.json() as NotionPage;
}

/**
 * Search for pages across the Notion workspace.
 */
export async function search(query: string, limit: number = 7): Promise<NotionPage[]> {
    const res = await notionFetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            query,
            page_size: limit,
            filter: { property: 'object', value: 'page' },
        }),
        timeoutMs: 10000,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Notion search failed: ${res.status} ${text}`);
    }

    const json = await res.json() as NotionQueryResponse;
    return json.results;
}

/**
 * Get a single Notion page by ID.
 */
export async function getPage(pageId: string): Promise<NotionPage> {
    const res = await notionFetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'GET',
        headers: HEADERS,
        timeoutMs: 10000,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Get page failed: ${res.status} ${text}`);
    }

    return await res.json() as NotionPage;
}

// ─── Cached domain fetchers ───────────────────────────────────────────────────

const CACHE_KEYS = {
    tasks: 'notion:tasks',
    projects: 'notion:projects',
    goals: 'notion:goals',
} as const;

function invalidateDatabaseCache(databaseId: string): void {
    if (databaseId === NOTION_TASKS_DB) invalidate(CACHE_KEYS.tasks);
    else if (databaseId === NOTION_PROJECTS_DB) invalidate(CACHE_KEYS.projects);
    else if (databaseId === NOTION_GOALS_DB) invalidate(CACHE_KEYS.goals);
}

/** Fetch all tasks (cached for 5 minutes). */
export function fetchTasks(): Promise<NotionPage[]> {
    return cached(CACHE_KEYS.tasks, () => queryDatabase(NOTION_TASKS_DB));
}

/** Fetch all projects (cached for 5 minutes). */
export function fetchProjects(): Promise<NotionPage[]> {
    return cached(CACHE_KEYS.projects, () => queryDatabase(NOTION_PROJECTS_DB));
}

/** Fetch all goals (cached for 5 minutes). */
export function fetchGoals(): Promise<NotionPage[]> {
    return cached(CACHE_KEYS.goals, () => queryDatabase(NOTION_GOALS_DB));
}

// ─── Property helpers ─────────────────────────────────────────────────────────

/**
 * Extract plain text from a Notion title property.
 * Tries the official `title`-typed property first, then falls back to known
 * rich_text property names.
 */
export function getTitle(page: NotionPage): string {
    const props = page.properties ?? {};

    // 1. Official title-type property
    for (const prop of Object.values(props)) {
        if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            const text = prop.title[0].plain_text;
            if (text.trim().length > 0) return text;
        }
    }

    // 2. Fallback: common rich_text property names
    const candidates = ['Title', 'Name', 'Goal', 'Project', 'Task'];
    for (const name of candidates) {
        const prop = props[name] ?? props[Object.keys(props).find(k => k.toLowerCase() === name.toLowerCase()) ?? ''];
        if (prop?.rich_text && prop.rich_text.length > 0) {
            return prop.rich_text[0].plain_text;
        }
    }

    return 'Untitled';
}

/**
 * Extract plain text from a Description/Notes/Summary rich_text property.
 */
export function getDescription(page: NotionPage): string | null {
    const props = page.properties ?? {};
    const descProp = props['Description']?.rich_text ?? props['Notes']?.rich_text ?? props['Summary']?.rich_text;
    return descProp?.[0]?.plain_text ?? null;
}

/**
 * Get IDs of related pages from a named relation property.
 */
export function getRelationIds(page: NotionPage, propertyName: string): string[] {
    const props = page.properties ?? {};
    const prop =
        props[propertyName] ??
        props[Object.keys(props).find(k => k.toLowerCase().includes(propertyName.toLowerCase())) ?? ''];

    if (prop?.type === 'relation' && prop.relation) {
        return prop.relation.map(r => r.id);
    }
    return [];
}

/**
 * Check whether a page has at least one relation property set.
 * Pass `propertyName` to check a specific relation.
 */
export function hasRelation(page: NotionPage, propertyName: string | null = null): boolean {
    const props = page.properties ?? {};

    if (propertyName) {
        return getRelationIds(page, propertyName).length > 0;
    }

    return Object.values(props).some(prop => prop?.type === 'relation' && (prop.relation?.length ?? 0) > 0);
}

/**
 * Return `true` if the page status matches any done/completed/cancelled value.
 */
export function isCompleted(page: NotionPage): boolean {
    const status = page.properties?.['Status']?.status?.name ?? '';
    return /completed|canceled|cancelled|done/i.test(status);
}

/**
 * Extract the start date string from a Notion date property.
 */
export function getDate(page: NotionPage, propertyName: string): string | null {
    return page.properties?.[propertyName]?.date?.start ?? null;
}

// ─── Project status helpers ───────────────────────────────────────────────────

export const PROJECT_STATUS = {
    ACTIVE: ['in progress'],
    READY: ['ready to start', 'ready for review'],
    BACKLOG: ['backlog'],
    PARKED: ['parked', 'on hold'],
    DONE: ['done', 'completed', 'cancelled', 'canceled'],
} as const;

export type ProjectStatusCategory = 'ACTIVE' | 'READY' | 'BACKLOG' | 'PARKED' | 'DONE' | 'UNKNOWN';

export function getProjectStatusCategory(page: NotionPage): ProjectStatusCategory {
    const status = (
        page.properties?.['Status']?.status?.name ??
        page.properties?.['Status']?.select?.name ??
        ''
    ).trim().toLowerCase();

    if ((PROJECT_STATUS.ACTIVE as readonly string[]).includes(status)) return 'ACTIVE';
    if ((PROJECT_STATUS.READY as readonly string[]).includes(status)) return 'READY';
    if ((PROJECT_STATUS.BACKLOG as readonly string[]).includes(status)) return 'BACKLOG';
    if ((PROJECT_STATUS.PARKED as readonly string[]).includes(status)) return 'PARKED';
    if ((PROJECT_STATUS.DONE as readonly string[]).includes(status)) return 'DONE';
    return 'UNKNOWN';
}

/** True if the project's "Evergreen" checkbox is checked. */
export function isEvergreen(page: NotionPage): boolean {
    return page.properties?.['Evergreen']?.checkbox === true;
}

/** True if the project's "Blocked?" checkbox is checked. */
export function isBlocked(page: NotionPage): boolean {
    return page.properties?.['Blocked?']?.checkbox === true;
}

/**
 * True if a project is truly active: In Progress + not blocked + not evergreen.
 * Use this everywhere instead of hardcoding status checks.
 */
export function isActiveProject(page: NotionPage): boolean {
    return getProjectStatusCategory(page) === 'ACTIVE' && !isBlocked(page) && !isEvergreen(page);
}
