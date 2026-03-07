/**
 * TodoistProvider — stub implementation.
 *
 * To activate: set PROVIDER=todoist and TODOIST_API_TOKEN=<token> in .env.
 * Then implement each method using the Todoist REST API v2:
 * https://developer.todoist.com/rest/v2/
 *
 * Todoist mapping notes:
 *   Task    -> Todoist Task   (id, content, due, priority, project_id)
 *   Project -> Todoist Project (id, name)
 *   Goal    -> Todoist Section or Label (no native concept; use labels as goal proxies)
 */
import type {
    TodoProvider,
    Task,
    Project,
    Goal,
    CreateTaskParams,
    HealthCheckResult,
} from '../types';

export class TodoistProvider implements TodoProvider {
    readonly name = 'Todoist';

    private readonly token: string;
    private readonly baseUrl = 'https://api.todoist.com/rest/v2';

    constructor() {
        const token = process.env.TODOIST_API_TOKEN;
        if (!token) throw new Error('TODOIST_API_TOKEN is required for the Todoist provider.');
        this.token = token;
    }

    private async get(path: string): Promise<unknown> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) throw new Error(`Todoist GET ${path} failed: ${res.status}`);
        return res.json();
    }

    async fetchTasks(): Promise<Task[]> {
        // GET /tasks returns all active (non-completed) tasks
        const raw = await this.get('/tasks') as any[];
        return raw.map(t => ({
            id: String(t.id),
            shortId: null, // Todoist doesn't have short numeric IDs
            title: t.content,
            description: t.description || null,
            status: t.is_completed ? 'done' : 'not_started',
            priority: `p${5 - t.priority}`, // Todoist uses 1=normal...4=urgent (inverted)
            dueDate: t.due?.date ?? null,
            scheduledDate: null,
            projectId: t.project_id ? String(t.project_id) : null,
            url: t.url,
            completed: t.is_completed,
        }));
    }

    async fetchProjects(): Promise<Project[]> {
        const raw = await this.get('/projects') as any[];
        return raw.map(p => ({
            id: String(p.id),
            title: p.name,
            description: null,
            status: null,
            statusCategory: 'ACTIVE' as const,
            blocked: false,
            active: true,
            evergreen: false,
            goalIds: [],
            url: p.url,
        }));
    }

    async fetchGoals(): Promise<Goal[]> {
        // Todoist has no native goals — return empty until mapped to sections/labels
        return [];
    }

    async getTaskByShortId(_shortId: number): Promise<Task | null> {
        // Todoist doesn't support short numeric IDs
        return null;
    }

    async searchTasks(query: string, limit = 7): Promise<Task[]> {
        const tasks = await this.fetchTasks();
        return tasks
            .filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
            .slice(0, limit);
    }

    async updateTaskStatus(taskId: string, status: string): Promise<Task> {
        if (status.toLowerCase() === 'done' || status.toLowerCase() === 'completed') {
            await fetch(`${this.baseUrl}/tasks/${taskId}/close`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.token}` },
            });
        }
        // Re-fetch to return updated task
        const raw = await this.get(`/tasks/${taskId}`) as any;
        return {
            id: String(raw.id),
            shortId: null,
            title: raw.content,
            description: raw.description || null,
            status: raw.is_completed ? 'done' : status,
            priority: `p${5 - raw.priority}`,
            dueDate: raw.due?.date ?? null,
            scheduledDate: null,
            projectId: raw.project_id ? String(raw.project_id) : null,
            url: raw.url,
            completed: raw.is_completed,
        };
    }

    async rescheduleTask(taskId: string, date: string | null): Promise<Task> {
        await fetch(`${this.baseUrl}/tasks/${taskId}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ due_date: date }),
        });
        const raw = await this.get(`/tasks/${taskId}`) as any;
        return {
            id: String(raw.id),
            shortId: null,
            title: raw.content,
            description: raw.description || null,
            status: raw.is_completed ? 'done' : 'not_started',
            priority: `p${5 - raw.priority}`,
            dueDate: raw.due?.date ?? null,
            scheduledDate: date,
            projectId: raw.project_id ? String(raw.project_id) : null,
            url: raw.url,
            completed: raw.is_completed,
        };
    }

    async createTask(params: CreateTaskParams): Promise<Task> {
        const body: Record<string, unknown> = { content: params.title };
        if (params.dueDate) body.due_date = params.dueDate;
        if (params.projectId) body.project_id = params.projectId;
        if (params.description) body.description = params.description;
        const res = await fetch(`${this.baseUrl}/tasks`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        const raw = await res.json() as any;
        return {
            id: String(raw.id),
            shortId: null,
            title: raw.content,
            description: raw.description || null,
            status: 'not_started',
            priority: null,
            dueDate: raw.due?.date ?? null,
            scheduledDate: null,
            projectId: raw.project_id ? String(raw.project_id) : null,
            url: raw.url,
            completed: false,
        };
    }

    async healthCheck(): Promise<HealthCheckResult> {
        const tasks = await this.fetchTasks();
        return {
            ok: true,
            issues: [],
            stats: { taskCount: tasks.length, projectCount: 0, goalCount: 0 },
        };
    }
}
