/**
 * NotionProvider — implements TodoProvider on top of the existing Notion client.
 *
 * This is a thin adapter: it calls the low-level Notion client and maps
 * results to the normalized Task / Project / Goal types.
 */
import {
    fetchTasks as notionFetchTasks,
    fetchProjects as notionFetchProjects,
    fetchGoals as notionFetchGoals,
    getTaskByShortId as notionGetTaskByShortId,
    updateTaskStatus as notionUpdateTaskStatus,
    updatePage,
    createPage,
    search as notionSearch,
    getTitle,
    getDescription,
    getStatus,
    getSelect,
    getDate,
    getNumber,
    isCompleted,
    isBlocked,
    isEvergreen,
    isActiveProject,
    getProjectStatusCategory,
    getRelationIds,
    NotionPage,
} from '../../notion/client';
import { runHealthCheck } from '../../notion/health';
import type {
    TodoProvider,
    Task,
    Project,
    Goal,
    CreateTaskParams,
    HealthCheckResult,
} from '../types';

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapTask(page: NotionPage): Task {
    const shortIdProp = page.properties?.['Task ID'] as any;
    const shortId: number | null =
        shortIdProp?.type === 'unique_id' && shortIdProp.unique_id?.number != null
            ? shortIdProp.unique_id.number
            : null;

    const projectRelation = getRelationIds(page, 'Project');

    return {
        id: page.id,
        shortId,
        title: getTitle(page),
        description: getDescription(page),
        status: getStatus(page) ?? 'not_started',
        priority: getSelect(page, 'Priority'),
        dueDate: getDate(page, 'Due Date') ?? getDate(page, 'Due'),
        scheduledDate: getDate(page, 'Scheduled'),
        projectId: projectRelation[0] ?? null,
        url: page.url,
        completed: isCompleted(page),
        raw: page.properties as unknown as Record<string, unknown>,
    };
}

function mapProject(page: NotionPage): Project {
    return {
        id: page.id,
        title: getTitle(page),
        description: getDescription(page),
        status: getStatus(page) ?? getSelect(page, 'Status'),
        statusCategory: getProjectStatusCategory(page),
        blocked: isBlocked(page),
        active: isActiveProject(page),
        evergreen: isEvergreen(page),
        goalIds: getRelationIds(page, 'Goal'),
        url: page.url,
        raw: page.properties as unknown as Record<string, unknown>,
    };
}

function mapGoal(page: NotionPage): Goal {
    return {
        id: page.id,
        title: getTitle(page),
        description: getDescription(page),
        completed: isCompleted(page),
        url: page.url,
        raw: page.properties as unknown as Record<string, unknown>,
    };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class NotionProvider implements TodoProvider {
    readonly name = 'Notion';

    async fetchTasks(): Promise<Task[]> {
        const pages = await notionFetchTasks();
        return pages.map(mapTask);
    }

    async fetchProjects(): Promise<Project[]> {
        const pages = await notionFetchProjects();
        return pages.map(mapProject);
    }

    async fetchGoals(): Promise<Goal[]> {
        const pages = await notionFetchGoals();
        return pages.map(mapGoal);
    }

    async getTaskByShortId(shortId: number): Promise<Task | null> {
        const page = await notionGetTaskByShortId(shortId);
        return page ? mapTask(page) : null;
    }

    async searchTasks(query: string, limit = 7): Promise<Task[]> {
        const pages = await notionSearch(query, limit);
        return pages.map(mapTask);
    }

    async updateTaskStatus(taskId: string, status: string): Promise<Task> {
        const page = await notionUpdateTaskStatus(taskId, status);
        return mapTask(page);
    }

    async rescheduleTask(taskId: string, date: string | null): Promise<Task> {
        const page = await updatePage(taskId, {
            'Scheduled': { type: 'date', date: date ? { start: date, end: null } : null },
        });
        return mapTask(page);
    }

    async createTask(params: CreateTaskParams): Promise<Task> {
        const NOTION_TASKS_DB = process.env.NOTION_TASKS_DB!;
        const properties: Record<string, any> = {
            'Name': { title: [{ text: { content: params.title } }] },
        };
        if (params.status) {
            properties['Status'] = { status: { name: params.status } };
        }
        if (params.priority) {
            properties['Priority'] = { select: { name: params.priority } };
        }
        if (params.dueDate) {
            properties['Due Date'] = { date: { start: params.dueDate, end: null } };
        }
        if (params.scheduledDate) {
            properties['Scheduled'] = { date: { start: params.scheduledDate, end: null } };
        }
        if (params.description) {
            properties['Notes'] = { rich_text: [{ text: { content: params.description } }] };
        }
        if (params.projectId) {
            properties['Project'] = { relation: [{ id: params.projectId }] };
        }
        const page = await createPage(NOTION_TASKS_DB, properties);
        return mapTask(page);
    }

    async healthCheck(): Promise<HealthCheckResult> {
        const [tasks, projects, goals, health] = await Promise.all([
            this.fetchTasks(),
            this.fetchProjects(),
            this.fetchGoals(),
            runHealthCheck(),
        ]);

        const issues = [];

        if (health.issues.orphanedTasks.length > 0) {
            issues.push({
                severity: 'warning' as const,
                message: `${health.issues.orphanedTasks.length} tasks not linked to any project`,
                affectedIds: health.issues.orphanedTasks.map(t => t.id),
            });
        }
        if (health.issues.overdueDueDate.length > 0) {
            issues.push({
                severity: 'error' as const,
                message: `${health.issues.overdueDueDate.length} overdue tasks`,
                affectedIds: health.issues.overdueDueDate.map(t => t.id),
            });
        }
        if (health.issues.projectsWithoutGoal.length > 0) {
            issues.push({
                severity: 'warning' as const,
                message: `${health.issues.projectsWithoutGoal.length} projects not linked to a goal`,
                affectedIds: health.issues.projectsWithoutGoal.map(p => p.id),
            });
        }

        return {
            ok: issues.filter(i => i.severity === 'error').length === 0,
            issues,
            stats: {
                taskCount: tasks.length,
                projectCount: projects.length,
                goalCount: goals.length,
            },
        };
    }
}
