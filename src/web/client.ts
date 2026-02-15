/**
 * API client for the Project Manager backend
 * Includes localStorage cache with 5-minute TTL
 */
const BASE = '/api';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Cache Layer ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

function cacheGet<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(`pm_cache_${key}`);
        if (!raw) return null;
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            localStorage.removeItem(`pm_cache_${key}`);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

function cacheSet<T>(key: string, data: T): void {
    try {
        const entry: CacheEntry<T> = { data, timestamp: Date.now() };
        localStorage.setItem(`pm_cache_${key}`, JSON.stringify(entry));
    } catch {
        // quota exceeded or private browsing — silently fail
    }
}

export function clearCache(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('pm_cache_'));
    keys.forEach(k => localStorage.removeItem(k));
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

async function get<T>(path: string, skipCache = false): Promise<T> {
    if (!skipCache) {
        const cached = cacheGet<T>(path);
        if (cached) return cached;
    }
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    const data: T = await res.json();
    cacheSet(path, data);
    return data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardData {
    metrics: {
        activeTasks: number;
        totalTasks: number;
        activeProjects: number;
        totalProjects: number;
        activeGoals: number;
        totalGoals: number;
        healthIssues: number;
    };
    todayTasks: TaskItem[];
    overdueTasks: TaskItem[];
    todayImpact: {
        projectsAffected: Array<{ title: string; url: string; taskCount: number }>;
        goalsAffected: Array<{ title: string; url: string; progress: number; projectsInGoal: number }>;
    };
}

export interface TaskItem {
    id: string;
    title: string;
    status: string | null;
    priority: string | null;
    dueDate: string | null;
    scheduledDate: string | null;
    hasProject: boolean;
    completed: boolean;
    url: string;
    score?: number;
}

export interface ProjectItem {
    id: string;
    title: string;
    status: string | null;
    statusCategory: string;
    blocked: boolean;
    active: boolean;
    description: string | null;
    url: string;
    taskCount: number;
}

export interface GoalItem {
    id: string;
    title: string;
    completed: boolean;
    description: string | null;
    url: string;
    progress: number;
    projectCount: number;
    completedProjects: number;
}

export interface HealthData {
    totals: {
        tasks: number;
        activeTasks: number;
        projects: number;
        goals: number;
    };
    issues: {
        orphanedTasks: TaskItem[];
        projectsWithoutGoal: ProjectItem[];
        overdueDueDate: TaskItem[];
        overdueScheduled: TaskItem[];
        missingRequiredFields: TaskItem[];
        missingDescription: TaskItem[];
        projectsMissingDescription: ProjectItem[];
    };
}

export interface StrategyData {
    metrics: {
        activeGoalsCount: number;
        activeProjectsCount: number;
        activeTasksCount: number;
        focusScore: number;
    };
    issues: {
        stalledGoals: GoalItem[];
        zombieProjects: ProjectItem[];
        isOverloaded: boolean;
    };
    progress: Array<{
        id: string;
        title: string;
        url: string;
        percent: number;
        total: number;
        completed: number;
    }>;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export const api = {
    dashboard: () => get<DashboardData>('/dashboard'),
    tasks:     () => get<TaskItem[]>('/tasks'),
    projects:  () => get<ProjectItem[]>('/projects'),
    goals:     () => get<GoalItem[]>('/goals'),
    health:    () => get<HealthData>('/analysis/health'),
    strategy:  () => get<StrategyData>('/analysis/strategy'),
    aiInsight: () => post<{ insight: string }>('/ai/insight'),
    motivation: () => post<{ motivation: string }>('/ai/motivation'),
};
