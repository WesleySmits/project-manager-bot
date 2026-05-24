import { describe, expect, it, vi, afterEach } from 'vitest';
import { emptyAgenticDashboard, getAgenticDashboard, todayInTimezone } from './dashboard';
import { mapDashboardItem, mapDecision, mapReportHealth } from './mappers';
import { buildStartHere } from './startHere';
import type { NotionPage } from '../notion/client';

afterEach(() => {
    vi.unstubAllEnvs();
});

function page(id: string, properties: NotionPage['properties'], url = `https://notion.so/${id}`): NotionPage {
    return {
        id,
        url,
        created_time: '2026-05-20T08:00:00.000Z',
        last_edited_time: '2026-05-20T08:00:00.000Z',
        properties,
    };
}

const title = (value: string) => ({ type: 'title' as const, title: [{ plain_text: value }] });
const richText = (value: string) => ({ type: 'rich_text' as const, rich_text: [{ plain_text: value }] });
const select = (value: string) => ({ type: 'select' as const, select: { name: value } });
const status = (value: string) => ({ type: 'status' as const, status: { name: value } });
const date = (value: string) => ({ type: 'date' as const, date: { start: value, end: null } });
const checkbox = (value: boolean) => ({ type: 'checkbox' as const, checkbox: value });
const number = (value: number) => ({ type: 'number' as const, number: value });

describe('agentic dashboard disabled response', () => {
    it('returns a disabled empty response when Agentic env vars are missing', async () => {
        vi.stubEnv('AGENTIC_DASHBOARD_ITEMS_DB', '');
        vi.stubEnv('AGENTIC_REPORTS_DB', '');
        vi.stubEnv('AGENTIC_DECISION_QUEUE_DB', '');

        const result = await getAgenticDashboard(new Date('2026-05-24T07:00:00.000Z'));

        expect(result.enabled).toBe(false);
        expect(result.mode).toBe('disabled');
        expect(result.startHere).toEqual([]);
        expect(result.warnings[0]).toContain('AGENTIC_DASHBOARD_ITEMS_DB');
    });

    it('uses Europe/Moscow by default for dashboard dates', () => {
        expect(todayInTimezone(new Date('2026-05-23T22:30:00.000Z'))).toBe('2026-05-24');
    });

    it('can build an explicit empty response for frontend fallbacks', () => {
        const result = emptyAgenticDashboard('error', ['fallback'], new Date('2026-05-24T00:00:00.000Z'));
        expect(result.mode).toBe('error');
        expect(result.warnings).toEqual(['fallback']);
    });
});

describe('agentic Notion mappers', () => {
    it('maps dashboard items from Notion-like pages', () => {
        const item = mapDashboardItem(page('d1', {
            Item: title('Reply to client'),
            Area: select('Mail'),
            Priority: select('High'),
            Source: select('Spark'),
            'Source Key': richText('spark:inbox:1'),
            Summary: richText('Client needs a response.'),
            'Next Step': richText('Draft the reply.'),
            'For Date': date('2026-05-24'),
            'Sort Score': number(91),
            'Sensitive?': checkbox(true),
            'External Action?': checkbox(false),
        }));

        expect(item).toMatchObject({
            title: 'Reply to client',
            area: 'Mail',
            priority: 'High',
            source: 'Spark',
            sourceKey: 'spark:inbox:1',
            summary: 'Client needs a response.',
            nextStep: 'Draft the reply.',
            sortScore: 91,
            sensitive: true,
            externalAction: false,
        });
    });

    it('maps decision queue pages', () => {
        const decision = mapDecision(page('decision-1', {
            Decision: title('Choose launch path'),
            Status: select('New'),
            Area: select('Product'),
            Priority: select('Critical'),
            'Risk Level': select('High'),
            'Decision Needed': richText('Pick direct launch or waitlist.'),
            'Due Date': date('2026-05-25'),
        }));

        expect(decision.title).toBe('Choose launch path');
        expect(decision.priority).toBe('Critical');
        expect(decision.decisionNeeded).toBe('Pick direct launch or waitlist.');
    });

    it('maps report health states', () => {
        const reports = [
            page('fresh', {
                'Report Type': select('Daily Operator Brief'),
                Status: select('Done'),
                'Report Date': date('2026-05-24'),
                Summary: richText('Fresh brief.'),
            }),
            page('review', {
                'Report Type': select('Spark Mail Morning Review'),
                Status: select('Needs Review'),
                'Report Date': date('2026-05-23'),
                Summary: richText('Spark auth blocked.'),
            }),
            page('stale', {
                'Report Type': select('Readiness Audit'),
                Status: select('Done'),
                'Report Date': date('2026-05-10'),
            }),
        ];

        expect(mapReportHealth('Daily Brief', 'Daily Operator Brief', reports, '2026-05-24', 0).status).toBe('Fresh');
        expect(mapReportHealth('Spark Mail', 'Spark Mail Morning Review', reports, '2026-05-24', 0).status).toBe('Needs Review');
        expect(mapReportHealth('Readiness', 'Readiness Audit', reports, '2026-05-24', 7).status).toBe('Stale');
        expect(mapReportHealth('Finance', 'Finance Tracker Report', reports, '2026-05-24', 35).status).toBe('Missing');
    });
});

describe('agentic Start Here selection', () => {
    it('prioritizes curated items, dedupes by source key, and caps area count', () => {
        const startHere = buildStartHere({
            today: '2026-05-24',
            dashboardItems: [
                {
                    id: 'mail-1',
                    title: 'Mail one',
                    area: 'Mail',
                    priority: 'High',
                    source: 'Spark',
                    sourceKey: 'spark:1',
                    summary: 'First mail item',
                    nextStep: 'Reply',
                    sortScore: 100,
                    sensitive: false,
                    externalAction: false,
                },
                {
                    id: 'mail-duplicate',
                    title: 'Mail duplicate',
                    area: 'Mail',
                    priority: 'High',
                    source: 'Spark',
                    sourceKey: 'spark:1',
                    summary: 'Duplicate',
                    nextStep: 'Skip',
                    sortScore: 99,
                    sensitive: false,
                    externalAction: false,
                },
                {
                    id: 'mail-2',
                    title: 'Mail two',
                    area: 'Mail',
                    priority: 'Medium',
                    source: 'Spark',
                    sourceKey: 'spark:2',
                    summary: 'Second mail item',
                    nextStep: 'Review',
                    sortScore: 98,
                    sensitive: false,
                    externalAction: false,
                },
                {
                    id: 'mail-3',
                    title: 'Mail three',
                    area: 'Mail',
                    priority: 'Medium',
                    source: 'Spark',
                    sourceKey: 'spark:3',
                    summary: 'Third mail item',
                    nextStep: 'Review',
                    sortScore: 97,
                    sensitive: false,
                    externalAction: false,
                },
            ],
            tasks: [
                {
                    id: 'task-1',
                    title: 'Overdue task',
                    priority: 'Medium',
                    status: 'In Progress',
                    dueDate: '2026-05-20',
                    blocked: false,
                },
            ],
            decisions: [],
            goals: [],
            projects: [],
            sourceHealth: [],
        });

        expect(startHere.map((item) => item.title)).toEqual(['Mail one', 'Mail two', 'Overdue task']);
        expect(startHere.filter((item) => item.area === 'Mail')).toHaveLength(2);
        expect(startHere.find((item) => item.title === 'Overdue task')?.priority).toBe('Critical');
    });
});
