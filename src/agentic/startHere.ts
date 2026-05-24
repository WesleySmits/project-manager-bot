import type { Goal, Project, Task } from '../providers';
import { toAgenticPriority } from './mappers';
import type {
    AgenticDashboardArea,
    AgenticDashboardItem,
    AgenticDecisionItem,
    AgenticPriority,
    AgenticReportHealth,
    AgenticStartHereItem,
} from './types';

export interface AgenticTaskCandidate {
    id: string;
    title: string;
    priority: AgenticPriority;
    status: string;
    dueDate?: string;
    url?: string;
    outcome?: string;
    readiness?: string;
    blocked: boolean;
}

export interface AgenticGoalCandidate {
    id: string;
    title: string;
    status: string;
    goalPriority: string;
    dashboardPriority: AgenticPriority;
    progress?: number;
    relatedProjectCount: number;
    url?: string;
}

export interface AgenticProjectCandidate {
    id: string;
    title: string;
    status: string;
    priority: AgenticPriority;
    readiness?: string;
    scope?: string;
    blocked: boolean;
    evergreen: boolean;
    taskCount: number;
    url?: string;
}

export interface StartHereInput {
    dashboardItems: AgenticDashboardItem[];
    tasks: AgenticTaskCandidate[];
    decisions: AgenticDecisionItem[];
    goals: AgenticGoalCandidate[];
    projects: AgenticProjectCandidate[];
    sourceHealth: AgenticReportHealth[];
    today: string;
}

export function buildStartHere(input: StartHereInput): AgenticStartHereItem[] {
    const candidates = [
        ...curatedCandidates(input.dashboardItems),
        ...taskCandidates(input.tasks, input.today),
        ...decisionCandidates(input.decisions),
        ...sourceHealthCandidates(input.sourceHealth),
        ...goalCandidates(input.goals),
        ...projectCandidates(input.projects),
    ];

    const seen = new Set<string>();
    const areaCounts = new Map<AgenticDashboardArea, number>();

    return candidates
        .sort((a, b) => b.sortScore - a.sortScore)
        .filter((item) => {
            const dedupeKey = item.sourceKey ?? item.url ?? `${item.area}:${item.title}`;
            if (seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);

            const currentAreaCount = areaCounts.get(item.area) ?? 0;
            if (currentAreaCount >= 2) return false;
            areaCounts.set(item.area, currentAreaCount + 1);

            return true;
        })
        .slice(0, 5);
}

export function taskToStartHereCandidate(task: Task): AgenticTaskCandidate {
    const status = task.status ?? 'Unknown';
    return {
        id: task.id,
        title: task.title,
        priority: toAgenticPriority(task.priority),
        status,
        dueDate: task.dueDate ?? task.scheduledDate ?? undefined,
        url: task.url,
        outcome: task.nextAction ?? task.whyNow ?? undefined,
        readiness: rawSelect(task.raw, 'Agent Readiness'),
        blocked: status.toLowerCase().includes('blocked') || rawCheckbox(task.raw, 'Blocked?'),
    };
}

export function goalToStartHereCandidate(goal: Goal, projects: Project[]): AgenticGoalCandidate {
    const goalPriority = rawSelect(goal.raw, 'Priority') || 'P3';
    return {
        id: goal.id,
        title: goal.title,
        status: goal.completed ? 'Done' : 'In Progress',
        goalPriority,
        dashboardPriority: goalPriorityToDashboardPriority(goalPriority),
        relatedProjectCount: projects.filter((project) => project.goalIds.includes(goal.id)).length,
        url: goal.url,
    };
}

export function projectToStartHereCandidate(project: Project, tasks: Task[]): AgenticProjectCandidate {
    return {
        id: project.id,
        title: project.title,
        status: project.status ?? project.statusCategory,
        priority: toAgenticPriority(rawSelect(project.raw, 'Priority')),
        readiness: rawSelect(project.raw, 'Agent Readiness'),
        scope: rawText(project.raw, 'Scope') ?? project.description ?? undefined,
        blocked: project.blocked,
        evergreen: project.evergreen,
        taskCount: tasks.filter((task) => !task.completed && task.projectId === project.id).length,
        url: project.url,
    };
}

function curatedCandidates(items: AgenticDashboardItem[]): AgenticStartHereItem[] {
    return items.map((item) => ({
        id: `dashboard:${item.id}`,
        title: item.title,
        area: item.area,
        priority: item.priority,
        source: item.source,
        sourceKey: item.sourceKey,
        why: item.summary || 'Curated by an Agentic OS feed.',
        nextStep: item.nextStep || 'Review the linked Notion item.',
        url: item.url,
        sortScore: 1_000 + item.sortScore,
    }));
}

function taskCandidates(tasks: AgenticTaskCandidate[], today: string): AgenticStartHereItem[] {
    return tasks
        .filter((task) => task.priority === 'High' || task.priority === 'Critical' || isOverdue(task.dueDate, today) || task.blocked)
        .map((task) => {
            const overdue = isOverdue(task.dueDate, today);
            return {
                id: `task:${task.id}`,
                title: task.title,
                area: 'Tasks',
                priority: overdue ? 'Critical' : task.priority,
                source: 'Tasks',
                why: task.blocked
                    ? 'This task is blocked.'
                    : overdue
                        ? `This task is overdue since ${task.dueDate}.`
                        : `${task.priority} priority task.`,
                nextStep: task.outcome || 'Open the task and decide the next concrete action.',
                url: task.url,
                sortScore: (overdue ? 850 : 760) + priorityBoost(task.priority),
            };
        });
}

function decisionCandidates(decisions: AgenticDecisionItem[]): AgenticStartHereItem[] {
    return decisions.slice(0, 8).map((decision) => ({
        id: `decision:${decision.id}`,
        title: decision.title,
        area: 'Decisions',
        priority: decision.priority,
        source: 'Decision Queue',
        why: `${decision.status} decision with ${decision.risk.toLowerCase()} risk.`,
        nextStep: decision.decisionNeeded || 'Choose whether to accept, defer, dismiss, or request more info.',
        url: decision.url,
        sortScore: 680 + priorityBoost(decision.priority),
    }));
}

function sourceHealthCandidates(sources: AgenticReportHealth[]): AgenticStartHereItem[] {
    return sources
        .filter((source) => source.status !== 'Fresh')
        .map((source) => ({
            id: `source:${source.reportType}`,
            title: `${source.label}: ${source.status}`,
            area: 'System',
            priority: source.status === 'Needs Review' || source.status === 'Missing' ? 'High' : 'Medium',
            source: 'Source Health',
            why: source.reason,
            nextStep: source.actionLabel,
            url: source.url,
            sortScore: source.status === 'Needs Review' ? 740 : source.status === 'Missing' ? 700 : 620,
        }));
}

function goalCandidates(goals: AgenticGoalCandidate[]): AgenticStartHereItem[] {
    return goals
        .filter((goal) => goal.goalPriority === 'P1' || goal.goalPriority === 'P2')
        .map((goal) => ({
            id: `goal:${goal.id}`,
            title: goal.title,
            area: 'Tasks',
            priority: goal.dashboardPriority,
            source: 'Goals',
            why: `${goal.goalPriority} goal${goal.progress ? `, ${goal.progress}% complete` : ''}.`,
            nextStep:
                goal.relatedProjectCount > 0
                    ? "Review linked projects and choose today's next action."
                    : 'Link or choose the project that moves this goal forward.',
            url: goal.url,
            sortScore: 600 + priorityBoost(goal.dashboardPriority),
        }));
}

function projectCandidates(projects: AgenticProjectCandidate[]): AgenticStartHereItem[] {
    return projects
        .filter((project) => !project.evergreen && project.status !== 'Done' && (project.blocked || project.taskCount === 0 || !project.scope))
        .map((project) => ({
            id: `project:${project.id}`,
            title: project.title,
            area: project.readiness === 'Ready for Agent' || project.readiness === 'Ready for Human' ? 'Readiness' : 'Tasks',
            priority: project.blocked ? 'High' : project.priority,
            source: 'Projects',
            why: project.blocked
                ? 'This active project is blocked.'
                : project.taskCount === 0
                    ? 'This active project has no linked tasks.'
                    : 'This active project is missing scope context.',
            nextStep: 'Open the project and define the next action or missing context.',
            url: project.url,
            sortScore: 560 + priorityBoost(project.priority),
        }));
}

function priorityBoost(priority: string): number {
    if (priority === 'Critical') return 80;
    if (priority === 'High') return 60;
    if (priority === 'Medium') return 30;
    return 10;
}

function isOverdue(date: string | undefined, today: string): boolean {
    return Boolean(date && date.slice(0, 10) < today);
}

function goalPriorityToDashboardPriority(value: string): AgenticPriority {
    if (value === 'P1') return 'Critical';
    if (value === 'P2') return 'High';
    if (value === 'P3') return 'Medium';
    return 'Low';
}

function rawSelect(raw: Record<string, unknown> | undefined, propertyName: string): string | undefined {
    const prop = rawProperty(raw, propertyName) as { type?: string; select?: { name?: string } | null; status?: { name?: string } | null } | undefined;
    if (prop?.type === 'select') return prop.select?.name;
    if (prop?.type === 'status') return prop.status?.name;
    return undefined;
}

function rawText(raw: Record<string, unknown> | undefined, propertyName: string): string | undefined {
    const prop = rawProperty(raw, propertyName) as { type?: string; rich_text?: Array<{ plain_text?: string }> } | undefined;
    if (prop?.type !== 'rich_text') return undefined;
    const value = prop.rich_text?.map((part) => part.plain_text ?? '').join('').trim();
    return value || undefined;
}

function rawCheckbox(raw: Record<string, unknown> | undefined, propertyName: string): boolean {
    const prop = rawProperty(raw, propertyName) as { type?: string; checkbox?: boolean } | undefined;
    return prop?.type === 'checkbox' && prop.checkbox === true;
}

function rawProperty(raw: Record<string, unknown> | undefined, propertyName: string): unknown {
    if (!raw) return undefined;
    return raw[propertyName] ?? raw[Object.keys(raw).find((key) => key.toLowerCase() === propertyName.toLowerCase()) ?? ''];
}
