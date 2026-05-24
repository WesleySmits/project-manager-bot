import type { NotionPage, NotionPropertyValue } from '../notion/client';
import type {
    AgenticDashboardArea,
    AgenticDashboardItem,
    AgenticDecisionItem,
    AgenticPriority,
    AgenticReportHealth,
} from './types';

const priorityRank: Record<AgenticPriority, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
};

const dashboardAreas = new Set<AgenticDashboardArea>([
    'Tasks',
    'Mail',
    'Decisions',
    'Finance',
    'Leads',
    'Readiness',
    'System',
]);

export function comparePriority(
    a: { priority: AgenticPriority; sortScore?: number },
    b: { priority: AgenticPriority; sortScore?: number },
): number {
    const scoreDelta = (b.sortScore ?? 0) - (a.sortScore ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    return priorityRank[b.priority] - priorityRank[a.priority];
}

export function toAgenticPriority(value: string | null | undefined): AgenticPriority {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized.includes('critical') || normalized.includes('urgent') || normalized === 'p0') return 'Critical';
    if (normalized.includes('high') || normalized === 'p1') return 'High';
    if (normalized.includes('medium') || normalized === 'p2') return 'Medium';
    if (normalized.includes('low') || normalized === 'p3' || normalized === 'p4') return 'Low';
    return 'Medium';
}

export function mapDashboardItem(page: NotionPage): AgenticDashboardItem {
    return {
        id: page.id,
        title: title(page, 'Item') || 'Untitled item',
        area: toDashboardArea(select(page, 'Area')),
        priority: toAgenticPriority(select(page, 'Priority')),
        source: select(page, 'Source') || 'Manual',
        sourceKey: text(page, 'Source Key') || undefined,
        summary: text(page, 'Summary'),
        nextStep: text(page, 'Next Step'),
        forDate: date(page, 'For Date'),
        lastSeenAt: date(page, 'Last Seen At'),
        sortScore: number(page, 'Sort Score'),
        sensitive: checkbox(page, 'Sensitive?'),
        externalAction: checkbox(page, 'External Action?'),
        url: page.url,
    };
}

export function mapDecision(page: NotionPage): AgenticDecisionItem {
    return {
        id: page.id,
        title: title(page, 'Decision') || title(page, 'Name') || 'Untitled decision',
        status: select(page, 'Status') || 'Unknown',
        area: select(page, 'Area') || 'Unknown',
        priority: toAgenticPriority(select(page, 'Priority')),
        risk: select(page, 'Risk Level') || 'Unknown',
        decisionNeeded: text(page, 'Decision Needed'),
        dueDate: date(page, 'Due Date'),
        url: page.url,
    };
}

export function mapReportHealth(
    label: string,
    reportType: string,
    pages: NotionPage[],
    today: string,
    freshnessDays: number,
): AgenticReportHealth {
    const report = pages.find((page) => select(page, 'Report Type') === reportType);
    const lastRun = report ? date(report, 'Report Date') : undefined;
    const reportStatus = report ? select(report, 'Status') : undefined;

    if (!report || !lastRun) {
        return {
            label,
            reportType,
            status: 'Missing',
            reason: `${label} missing: no report found.`,
            actionLabel: defaultReportAction(label),
        };
    }

    const age = daysBetween(lastRun, today);

    if (reportStatus === 'Needs Review') {
        const summary = text(report, 'Summary');
        return {
            label,
            reportType,
            lastRun,
            status: 'Needs Review',
            url: report.url,
            ageDays: age,
            reason: `${label} needs review: ${summary || 'latest report was marked Needs Review.'}`,
            actionLabel: 'Review report',
        };
    }

    const status = age <= freshnessDays ? 'Fresh' : 'Stale';
    return {
        label,
        reportType,
        lastRun,
        status,
        url: report.url,
        ageDays: age,
        reason:
            status === 'Fresh'
                ? `${label} fresh: last run ${humanAge(age)}.`
                : `${label} stale: last run ${humanAge(age)}.`,
        actionLabel: status === 'Fresh' ? 'Open report' : defaultReportAction(label),
    };
}

export function title(page: NotionPage, propertyName: string): string {
    const value = property(page, propertyName);
    return value?.type === 'title' ? value.title.map((part) => part.plain_text ?? '').join('') : '';
}

export function text(page: NotionPage, propertyName: string): string {
    const value = property(page, propertyName);
    return value?.type === 'rich_text' ? value.rich_text.map((part) => part.plain_text ?? '').join('') : '';
}

export function select(page: NotionPage, propertyName: string): string {
    const value = property(page, propertyName);
    if (value?.type === 'select') return value.select?.name ?? '';
    if (value?.type === 'status') return value.status?.name ?? '';
    return '';
}

export function date(page: NotionPage, propertyName: string): string | undefined {
    const value = property(page, propertyName);
    return value?.type === 'date' ? value.date?.start : undefined;
}

export function checkbox(page: NotionPage, propertyName: string): boolean {
    const value = property(page, propertyName);
    return value?.type === 'checkbox' ? value.checkbox : false;
}

export function number(page: NotionPage, propertyName: string): number {
    const value = property(page, propertyName);
    return value?.type === 'number' ? value.number ?? 0 : 0;
}

function property(page: NotionPage, propertyName: string): NotionPropertyValue | undefined {
    const props = page.properties ?? {};
    return props[propertyName] ?? props[Object.keys(props).find((key) => key.toLowerCase() === propertyName.toLowerCase()) ?? ''];
}

function toDashboardArea(value: string): AgenticDashboardArea {
    return dashboardAreas.has(value as AgenticDashboardArea) ? (value as AgenticDashboardArea) : 'System';
}

function daysBetween(start: string, end: string): number {
    const startDate = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
    const endDate = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(startDate) || Number.isNaN(endDate)) return Number.POSITIVE_INFINITY;
    return Math.floor((endDate - startDate) / 86_400_000);
}

function humanAge(ageDays: number): string {
    if (ageDays === 0) return 'today';
    if (ageDays === 1) return 'yesterday';
    if (Number.isFinite(ageDays)) return `${ageDays} days ago`;
    return 'at an unknown time';
}

function defaultReportAction(label: string): string {
    if (label === 'Spark Mail') return 'Run Spark review';
    if (label === 'Daily Brief') return 'Run daily brief';
    if (label === 'Weekly Review') return 'Run weekly review';
    if (label === 'Readiness') return 'Run readiness audit';
    if (label === 'Finance') return 'Run finance report';
    return 'Check source';
}
