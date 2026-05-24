import { getProvider } from '../providers';
import type { Goal, Project, Task } from '../providers';
import type { NotionFilter, NotionPage, NotionSort } from '../notion/client';
import { comparePriority, mapDashboardItem, mapDecision, mapReportHealth } from './mappers';
import {
    buildStartHere,
    goalToStartHereCandidate,
    projectToStartHereCandidate,
    taskToStartHereCandidate,
} from './startHere';
import type { AgenticDashboardData, AgenticDashboardItem } from './types';

const AGENTIC_ENV_KEYS = [
    'AGENTIC_DASHBOARD_ITEMS_DB',
    'AGENTIC_REPORTS_DB',
    'AGENTIC_DECISION_QUEUE_DB',
] as const;

type AgenticEnvKey = typeof AGENTIC_ENV_KEYS[number];

export function emptyAgenticDashboard(
    mode: AgenticDashboardData['mode'],
    warnings: string[],
    now = new Date(),
): AgenticDashboardData {
    return {
        enabled: mode === 'notion',
        generatedAt: now.toISOString(),
        today: todayInTimezone(now),
        mode,
        warnings,
        startHere: [],
        focusItems: [],
        mailItems: [],
        signals: [],
        decisions: [],
        sourceHealth: [],
    };
}

export async function getAgenticDashboard(now = new Date()): Promise<AgenticDashboardData> {
    const missing = missingAgenticConfig();
    if (missing.length > 0) {
        return emptyAgenticDashboard('disabled', [
            `Agentic feed disabled: missing optional env vars ${missing.join(', ')}.`,
        ], now);
    }

    const today = todayInTimezone(now);

    try {
        const provider = getProvider();
        const [{ queryDatabaseFiltered }, dashboardItemsDb, reportsDb, decisionsDb] = await Promise.all([
            import('../notion/client'),
            configuredEnv('AGENTIC_DASHBOARD_ITEMS_DB'),
            configuredEnv('AGENTIC_REPORTS_DB'),
            configuredEnv('AGENTIC_DECISION_QUEUE_DB'),
        ]);

        const [dashboardPages, reportPages, decisionPages, tasks, projects, goals] = await Promise.all([
            queryDatabaseFiltered(dashboardItemsDb, dashboardItemsFilter(today), [{ property: 'Sort Score', direction: 'descending' }], 50),
            queryDatabaseFiltered(reportsDb, undefined, [{ property: 'Report Date', direction: 'descending' }], 30),
            queryDatabaseFiltered(decisionsDb, decisionsFilter(), [{ property: 'Due Date', direction: 'ascending' }], 30),
            provider.fetchTasks(),
            provider.fetchProjects(),
            provider.fetchGoals(),
        ]);

        return shapeAgenticDashboard({
            dashboardPages,
            reportPages,
            decisionPages,
            tasks,
            projects,
            goals,
            today,
            now,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return emptyAgenticDashboard('error', [`Agentic feed unavailable: ${message}`], now);
    }
}

function shapeAgenticDashboard(input: {
    dashboardPages: NotionPage[];
    reportPages: NotionPage[];
    decisionPages: NotionPage[];
    tasks: Task[];
    projects: Project[];
    goals: Goal[];
    today: string;
    now: Date;
}): AgenticDashboardData {
    const dashboardItems = input.dashboardPages.map(mapDashboardItem).sort(comparePriority);
    const decisions = input.decisionPages.map(mapDecision).sort(comparePriority).slice(0, 8);
    const activeTasks = input.tasks.filter((task) => !task.completed);
    const activeGoals = input.goals.filter((goal) => !goal.completed);
    const sourceHealth = [
        mapReportHealth('Daily Brief', 'Daily Operator Brief', input.reportPages, input.today, 0),
        mapReportHealth('Spark Mail', 'Spark Mail Morning Review', input.reportPages, input.today, 0),
        mapReportHealth('Readiness', 'Readiness Audit', input.reportPages, input.today, 7),
        mapReportHealth('Weekly Review', 'Weekly Review', input.reportPages, input.today, 7),
        mapReportHealth('Finance', 'Finance Tracker Report', input.reportPages, input.today, 35),
    ];

    return {
        enabled: true,
        generatedAt: input.now.toISOString(),
        today: input.today,
        mode: 'notion',
        warnings: [],
        startHere: buildStartHere({
            dashboardItems,
            tasks: activeTasks.map(taskToStartHereCandidate),
            decisions,
            goals: activeGoals.map((goal) => goalToStartHereCandidate(goal, input.projects)),
            projects: input.projects.map((project) => projectToStartHereCandidate(project, input.tasks)),
            sourceHealth,
            today: input.today,
        }),
        focusItems: dashboardItems.filter((item) => item.area === 'Tasks' || item.area === 'Leads').slice(0, 8),
        mailItems: dashboardItems.filter((item) => item.area === 'Mail').slice(0, 8),
        signals: dashboardItems.filter(isSignal).slice(0, 8),
        decisions,
        sourceHealth,
    };
}

function isSignal(item: AgenticDashboardItem): boolean {
    return item.area === 'Finance' || item.area === 'Readiness' || item.area === 'System' || item.area === 'Decisions';
}

function missingAgenticConfig(): AgenticEnvKey[] {
    return AGENTIC_ENV_KEYS.filter((key) => !process.env[key]);
}

function configuredEnv(key: AgenticEnvKey): string {
    return process.env[key] as string;
}

function dashboardItemsFilter(today: string): NotionFilter {
    return {
        and: [
            { property: 'Status', select: { equals: 'Active' } },
            {
                or: [
                    { property: 'For Date', date: { on_or_before: today } },
                    { property: 'For Date', date: { is_empty: true } },
                ],
            },
        ],
    };
}

function decisionsFilter(): NotionFilter {
    return {
        or: [
            { property: 'Status', select: { equals: 'New' } },
            { property: 'Status', select: { equals: 'Needs More Info' } },
            { property: 'Status', select: { equals: 'Accepted' } },
        ],
    };
}

export function todayInTimezone(now = new Date(), timeZone = process.env.AGENTIC_TIMEZONE ?? process.env.TZ ?? 'Europe/Moscow'): string {
    try {
        const parts = new Intl.DateTimeFormat('en', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(now);
        const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
        return `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
        return now.toISOString().slice(0, 10);
    }
}
