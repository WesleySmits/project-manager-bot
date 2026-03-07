/**
 * Provider Abstraction Layer — Normalized Types & Interface
 *
 * This file defines the canonical data model and the TodoProvider interface
 * that every backend (Notion, Todoist, Linear, MCP, etc.) must implement.
 * Application code should ONLY import from this file and from `src/providers/index.ts`.
 */

// ─── Normalized Domain Types ──────────────────────────────────────────────────

/** Status lifecycle for tasks */
export type TaskStatus =
    | 'not_started'
    | 'in_progress'
    | 'blocked'
    | 'done'
    | 'cancelled'
    | string; // allow provider-specific passthrough

/** Priority levels */
export type TaskPriority = 'p1' | 'p2' | 'p3' | 'p4' | string;

/** A normalized task */
export interface Task {
    /** Provider-internal unique ID (e.g. Notion page ID, Todoist task ID) */
    id: string;
    /** Short numeric ID for human use (e.g. /done 42). May be null if unsupported. */
    shortId: number | null;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority | null;
    /** ISO date string (YYYY-MM-DD) or null */
    dueDate: string | null;
    /** ISO date string (YYYY-MM-DD) or null */
    scheduledDate: string | null;
    /** Whether this task is linked to a project */
    projectId: string | null;
    /** Direct link to the task in the source app */
    url: string;
    /** Whether the task is considered complete (derived from status) */
    completed: boolean;
    /** Raw provider-specific metadata (read-only, do not write back) */
    raw?: Record<string, unknown>;
}

/** Status lifecycle for projects */
export type ProjectStatusCategory =
    | 'ACTIVE'
    | 'READY'
    | 'BACKLOG'
    | 'PARKED'
    | 'DONE'
    | 'UNKNOWN';

/** A normalized project */
export interface Project {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    statusCategory: ProjectStatusCategory;
    blocked: boolean;
    active: boolean;
    evergreen: boolean;
    /** Goals this project is linked to */
    goalIds: string[];
    url: string;
    raw?: Record<string, unknown>;
}

/** A normalized goal */
export interface Goal {
    id: string;
    title: string;
    description: string | null;
    completed: boolean;
    url: string;
    raw?: Record<string, unknown>;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * TodoProvider — the contract every backend must implement.
 *
 * Implementations:
 *  - NotionProvider   (src/providers/notion/index.ts)
 *  - McpProvider      (src/providers/mcp/index.ts)      <- MCP-based todo apps
 *  - TodoistProvider  (src/providers/todoist/index.ts)  <- stub
 *
 * To add a new provider: implement this interface, register it in
 * src/providers/index.ts, and set PROVIDER=<name> in .env.
 */
export interface TodoProvider {
    /** Human-readable name shown in logs and UI */
    readonly name: string;

    // -- Read operations ---------------------------------------------------

    /** Fetch all non-completed tasks */
    fetchTasks(): Promise<Task[]>;

    /** Fetch all projects */
    fetchProjects(): Promise<Project[]>;

    /** Fetch all goals */
    fetchGoals(): Promise<Goal[]>;

    /**
     * Look up a task by its short numeric ID (e.g. the number you type in /done 42).
     * Returns null if not found or if the provider doesn't support short IDs.
     */
    getTaskByShortId(shortId: number): Promise<Task | null>;

    /**
     * Search tasks by text query.
     * Returns up to `limit` matches (default 7).
     */
    searchTasks(query: string, limit?: number): Promise<Task[]>;

    // -- Write operations --------------------------------------------------

    /**
     * Update a task's status.
     * The `status` value should be a valid status for this provider
     * (e.g. 'Done', 'In Progress').
     */
    updateTaskStatus(taskId: string, status: string): Promise<Task>;

    /**
     * Reschedule a task (update its scheduled/due date).
     * Pass null to clear the date.
     */
    rescheduleTask(taskId: string, date: string | null): Promise<Task>;

    /**
     * Create a new task.
     * Returns the created task.
     */
    createTask(params: CreateTaskParams): Promise<Task>;

    // -- Health / meta -----------------------------------------------------

    /**
     * Run a provider-specific health check.
     * Returns a list of human-readable issue strings, or empty array if all OK.
     */
    healthCheck(): Promise<HealthCheckResult>;
}

/** Parameters for creating a new task */
export interface CreateTaskParams {
    title: string;
    description?: string;
    status?: string;
    priority?: TaskPriority;
    dueDate?: string | null;
    scheduledDate?: string | null;
    projectId?: string | null;
}

/** Result of a provider health check */
export interface HealthCheckResult {
    ok: boolean;
    issues: HealthIssue[];
    stats: {
        taskCount: number;
        projectCount: number;
        goalCount: number;
    };
}

export interface HealthIssue {
    severity: 'error' | 'warning' | 'info';
    message: string;
    /** IDs of affected tasks/projects/goals */
    affectedIds?: string[];
}
