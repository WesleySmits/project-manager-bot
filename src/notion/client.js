/**
 * Shared Notion API client using raw HTTP for reliability
 */
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_TASKS_DB = process.env.NOTION_TASKS_DB || '28adeffc-b53c-80b1-bddd-e2b2673f11c3';
const NOTION_PROJECTS_DB = process.env.NOTION_PROJECTS_DB || '28adeffc-b53c-80e4-b946-d0abd4a47213';
const NOTION_GOALS_DB = process.env.NOTION_GOALS_DB || '28bdeffc-b53c-80b0-b0af-de14afe2bfbd';

const HEADERS = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
};

/**
 * Query a Notion database with pagination
 * @param {string} databaseId
 * @param {number} pageSize
 * @returns {Promise<Array>}
 */
async function queryDatabase(databaseId, pageSize = 100) {
  const results = [];
  let nextCursor = null;

  do {
    const body = { page_size: pageSize };
    if (nextCursor) body.start_cursor = nextCursor;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Notion query failed: ${res.status} ${text}`);
      }

      const json = await res.json();
      results.push(...json.results);
      nextCursor = json.has_more ? json.next_cursor : null;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  } while (nextCursor);

  return results;
}

/**
 * Fetch all tasks from the Tasks database
 */
async function fetchTasks() {
  return queryDatabase(NOTION_TASKS_DB);
}

/**
 * Fetch all projects from the Projects database
 */
async function fetchProjects() {
  return queryDatabase(NOTION_PROJECTS_DB);
}

/**
 * Fetch all goals from the Goals database
 */
async function fetchGoals() {
  return queryDatabase(NOTION_GOALS_DB);
}

/**
 * Extract title from a Notion page
 * Finds the property of type 'title', with fallbacks for text properties
 */
function getTitle(page) {
  const props = page.properties || {};
  let primaryTitle = null;

  // 1. Find the official primary 'title' property
  for (const key of Object.keys(props)) {
    if (props[key].type === 'title') {
      const text = props[key].title?.[0]?.plain_text;
      if (text && text.trim().length > 0) {
        return text;
      }
      primaryTitle = text; // Store empty result just in case
    }
  }

  // 2. Fallback: Look for specific named text properties (if primary was empty)
  // User mentions "Goals -> Title" or "Projects -> Project name"
  const candidates = ['Title', 'Name', 'Goal', 'Project', 'Task'];
  for (const name of candidates) {
    const prop = Object.values(props).find(p => p.id === name) || props[name] ||
      props[Object.keys(props).find(k => k.toLowerCase() === name.toLowerCase())];

    if (prop && prop.rich_text && prop.rich_text.length > 0) {
      return prop.rich_text[0].plain_text;
    }
  }

  return primaryTitle || 'Untitled';
}

/**
 * Extract description from a Notion page
 */
function getDescription(page) {
  const props = page.properties || {};
  // Try common description property names
  const descProp = props.Description?.rich_text || props.Notes?.rich_text || props.Summary?.rich_text;
  return descProp?.[0]?.plain_text || null;
}


/**
 * Get IDs of related pages from a relation property
 */
function getRelationIds(page, propertyName) {
  const props = page.properties || {};
  const prop = props[propertyName] ||
    // Try to find any relation property if name not exact matching common patterns
    Object.values(props).find(p => p.id === propertyName) || // if passed id
    props[Object.keys(props).find(k => k.toLowerCase().includes(propertyName.toLowerCase()))];

  if (prop?.type === 'relation' && prop.relation) {
    return prop.relation.map(r => r.id);
  }
  return [];
}

/**
 * Check if a page has any relation properties set
 */
function hasRelation(page, propertyName = null) {
  const props = page.properties || {};

  if (propertyName) {
    const ids = getRelationIds(page, propertyName);
    return ids.length > 0;
  }

  // Check any relation
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop?.type === 'relation' && prop.relation?.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a task is completed or canceled
 */
function isCompleted(page) {
  const status = page.properties?.Status?.status?.name || '';
  return /completed|canceled|cancelled|done/i.test(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Centralized Project Status Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Project status categories for consistent filtering across all commands
 */
const PROJECT_STATUS = {
  ACTIVE: ['in progress'],
  READY: ['ready to start', 'ready for review'],
  BACKLOG: ['backlog'],
  PARKED: ['parked', 'on hold'],
  DONE: ['done', 'completed', 'cancelled', 'canceled']
};

/**
 * Get the normalized status category for a project
 * @param {Object} page - Notion page object
 * @returns {'ACTIVE'|'READY'|'BACKLOG'|'PARKED'|'DONE'|'UNKNOWN'}
 */
function getProjectStatusCategory(page) {
  const status = (page.properties?.Status?.status?.name ||
    page.properties?.Status?.select?.name || '').trim().toLowerCase();

  if (PROJECT_STATUS.ACTIVE.includes(status)) return 'ACTIVE';
  if (PROJECT_STATUS.READY.includes(status)) return 'READY';
  if (PROJECT_STATUS.BACKLOG.includes(status)) return 'BACKLOG';
  if (PROJECT_STATUS.PARKED.includes(status)) return 'PARKED';
  if (PROJECT_STATUS.DONE.includes(status)) return 'DONE';
  return 'UNKNOWN';
}

/**
 * Check if a project is blocked (via "Blocked?" checkbox)
 * @param {Object} page - Notion page object
 * @returns {boolean}
 */
function isBlocked(page) {
  return page.properties?.['Blocked?']?.checkbox === true;
}

/**
 * Check if a project is truly active (In Progress + not blocked)
 * Use this for accurate "active project" counts in /strategy and /improve
 * @param {Object} page - Notion page object
 * @returns {boolean}
 */
function isActiveProject(page) {
  return getProjectStatusCategory(page) === 'ACTIVE' && !isBlocked(page);
}

/**
 * Get date from a date property
 */
function getDate(page, propertyName) {
  const dateProp = page.properties?.[propertyName]?.date;
  return dateProp?.start || null;
}


/**
 * Search for pages in Notion
 * @param {string} query - Search query
 * @param {number} limit
 */
async function search(query, limit = 7) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        query,
        page_size: limit,
        // Optional: filter for only pages if needed, but keeping it broad for now
        filter: { property: 'object', value: 'page' }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion search failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    return json.results;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Get a single page by ID
 */
async function getPage(pageId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: HEADERS,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Get page failed: ${res.status} ${text}`);
    }

    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

module.exports = {
  NOTION_TASKS_DB,
  NOTION_PROJECTS_DB,
  NOTION_GOALS_DB,
  queryDatabase,
  fetchTasks,
  fetchProjects,
  fetchGoals,
  getTitle,
  getDescription,
  hasRelation,
  isCompleted,
  getDate,
  getRelationIds,
  search,
  getPage,
  // Centralized status helpers
  PROJECT_STATUS,
  getProjectStatusCategory,
  isBlocked,
  isActiveProject
};

