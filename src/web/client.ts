/**
 * API client for the Project Manager backend
 */
const BASE = '/api';

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
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
        missingDescription: number;
        projectsMissingDescription: number;
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
};
