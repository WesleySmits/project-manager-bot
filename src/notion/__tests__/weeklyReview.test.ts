/**
 * Unit tests for weeklyReview.ts
 *
 * We test all pure helper functions in isolation, then the main getWeeklyReview()
 * function using mocked Notion fetchers — no real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import {
    parsePlainDate,
    getMondayOf,
    currentWeekMonday,
    isInWeek,
    getWeeklyReview,
} from '../weeklyReview';

// ─── Mock the Notion client module ────────────────────────────────────────────
vi.mock('../client', () => ({
    fetchTasks: vi.fn(),
    fetchProjects: vi.fn(),
    fetchGoals: vi.fn(),
    getTitle: (page: { _title?: string }) => page._title ?? 'Untitled',
    getDate: (page: Record<string, Record<string, string>>, prop: string) => page._dates?.[prop] ?? null,
    isCompleted: (page: { _completed?: boolean }) => page._completed === true,
}));

import * as client from '../client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal fake NotionPage-like object for testing. */
function makeTask(opts: {
    id?: string;
    title?: string;
    completed?: boolean;
    completedDate?: string;
    priority?: string;
    url?: string;
}) {
    return {
        id: opts.id ?? 'task-1',
        url: opts.url ?? 'https://notion.so/task-1',
        created_time: '2026-01-01T00:00:00.000Z',
        last_edited_time: '2026-01-01T00:00:00.000Z',
        _title: opts.title ?? 'Test Task',
        _completed: opts.completed ?? false,
        _dates: opts.completedDate ? { 'Completed Date': opts.completedDate } : {},
        properties: {
            Priority: { type: 'select', select: opts.priority ? { name: opts.priority } : null },
            Status: { type: 'status', status: { name: opts.completed ? 'Completed' : 'Not Started' } },
        },
    };
}

function makeProject(opts: {
    id?: string;
    title?: string;
    completed?: boolean;
    completedDate?: string;
    url?: string;
}) {
    return {
        id: opts.id ?? 'proj-1',
        url: opts.url ?? 'https://notion.so/proj-1',
        created_time: '2026-01-01T00:00:00.000Z',
        last_edited_time: '2026-01-01T00:00:00.000Z',
        _title: opts.title ?? 'Test Project',
        _completed: opts.completed ?? false,
        _dates: opts.completedDate ? { 'Completed Date': opts.completedDate } : {},
        properties: {
            Status: { type: 'status', status: { name: opts.completed ? 'Done' : 'In Progress' } },
        },
    };
}

function makeGoal(opts: {
    id?: string;
    title?: string;
    completed?: boolean;
    completedDate?: string;
    url?: string;
}) {
    return {
        id: opts.id ?? 'goal-1',
        url: opts.url ?? 'https://notion.so/goal-1',
        created_time: '2026-01-01T00:00:00.000Z',
        last_edited_time: '2026-01-01T00:00:00.000Z',
        _title: opts.title ?? 'Test Goal',
        _completed: opts.completed ?? false,
        _dates: opts.completedDate ? { 'Completed Date': opts.completedDate } : {},
        properties: {
            Status: { type: 'status', status: { name: opts.completed ? 'Done' : 'In Progress' } },
        },
    };
}

// ─── parsePlainDate ───────────────────────────────────────────────────────────

describe('parsePlainDate', () => {
    it('parses a valid ISO date string', () => {
        const result = parsePlainDate('2026-02-17');
        expect(result).not.toBeNull();
        expect(result!.toString()).toBe('2026-02-17');
    });

    it('returns null for null input', () => {
        expect(parsePlainDate(null)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parsePlainDate('')).toBeNull();
    });

    it('returns null for an invalid date string', () => {
        expect(parsePlainDate('not-a-date')).toBeNull();
    });

    it('returns null for a partial date', () => {
        expect(parsePlainDate('2026-02')).toBeNull();
    });
});

// ─── getMondayOf ─────────────────────────────────────────────────────────────

describe('getMondayOf', () => {
    it('returns itself when date is already Monday', () => {
        const monday = Temporal.PlainDate.from('2026-02-16'); // known Monday
        expect(getMondayOf(monday).toString()).toBe('2026-02-16');
    });

    it('returns the correct Monday for a Wednesday', () => {
        const wednesday = Temporal.PlainDate.from('2026-02-18');
        expect(getMondayOf(wednesday).toString()).toBe('2026-02-16');
    });

    it('returns the correct Monday for a Sunday', () => {
        const sunday = Temporal.PlainDate.from('2026-02-22');
        expect(getMondayOf(sunday).toString()).toBe('2026-02-16');
    });

    it('returns the correct Monday for a Saturday', () => {
        const saturday = Temporal.PlainDate.from('2026-02-21');
        expect(getMondayOf(saturday).toString()).toBe('2026-02-16');
    });
});

// ─── isInWeek ─────────────────────────────────────────────────────────────────

describe('isInWeek', () => {
    const weekStart = Temporal.PlainDate.from('2026-02-16'); // Mon

    it('returns true for the Monday itself', () => {
        expect(isInWeek(Temporal.PlainDate.from('2026-02-16'), weekStart)).toBe(true);
    });

    it('returns true for a mid-week date', () => {
        expect(isInWeek(Temporal.PlainDate.from('2026-02-18'), weekStart)).toBe(true);
    });

    it('returns true for the Sunday', () => {
        expect(isInWeek(Temporal.PlainDate.from('2026-02-22'), weekStart)).toBe(true);
    });

    it('returns false for the day before Monday', () => {
        expect(isInWeek(Temporal.PlainDate.from('2026-02-15'), weekStart)).toBe(false);
    });

    it('returns false for the day after Sunday', () => {
        expect(isInWeek(Temporal.PlainDate.from('2026-02-23'), weekStart)).toBe(false);
    });
});

// ─── getWeeklyReview ──────────────────────────────────────────────────────────

describe('getWeeklyReview', () => {
    beforeEach(() => {
        vi.mocked(client.fetchTasks).mockResolvedValue([]);
        vi.mocked(client.fetchProjects).mockResolvedValue([]);
        vi.mocked(client.fetchGoals).mockResolvedValue([]);
    });

    it('throws when weekStartStr is not a Monday', async () => {
        await expect(getWeeklyReview('2026-02-18')).rejects.toThrow('not a Monday');
    });

    it('throws for an invalid date string', async () => {
        await expect(getWeeklyReview('garbage')).rejects.toThrow('Invalid date');
    });

    it('returns correct weekStart and weekEnd for a given Monday', async () => {
        const result = await getWeeklyReview('2026-02-16');
        expect(result.weekStart).toBe('2026-02-16');
        expect(result.weekEnd).toBe('2026-02-22');
    });

    it('returns empty arrays and zero totals when nothing was completed', async () => {
        const result = await getWeeklyReview('2026-02-16');
        expect(result.tasks).toHaveLength(0);
        expect(result.projects).toHaveLength(0);
        expect(result.goals).toHaveLength(0);
        expect(result.totals).toEqual({ tasks: 0, projects: 0, goals: 0 });
    });

    it('includes tasks completed within the week', async () => {
        vi.mocked(client.fetchTasks).mockResolvedValue([
            makeTask({ id: 't1', title: 'Inside task', completed: true, completedDate: '2026-02-18' }),
            makeTask({ id: 't2', title: 'Outside task', completed: true, completedDate: '2026-02-23' }),
            makeTask({ id: 't3', title: 'Not done task', completed: false, completedDate: '2026-02-18' }),
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].id).toBe('t1');
        expect(result.tasks[0].title).toBe('Inside task');
        expect(result.totals.tasks).toBe(1);
    });

    it('includes tasks on Monday and Sunday boundaries', async () => {
        vi.mocked(client.fetchTasks).mockResolvedValue([
            makeTask({ id: 't1', completed: true, completedDate: '2026-02-16' }), // Monday
            makeTask({ id: 't2', completed: true, completedDate: '2026-02-22' }), // Sunday
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.tasks).toHaveLength(2);
    });

    it('excludes tasks with no Completed Date', async () => {
        vi.mocked(client.fetchTasks).mockResolvedValue([
            makeTask({ id: 't1', completed: true, completedDate: undefined }),
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.tasks).toHaveLength(0);
    });

    it('includes projects completed within the week', async () => {
        vi.mocked(client.fetchProjects).mockResolvedValue([
            makeProject({ id: 'p1', title: 'Done project', completed: true, completedDate: '2026-02-19' }),
            makeProject({ id: 'p2', title: 'Active project', completed: false }),
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.projects).toHaveLength(1);
        expect(result.projects[0].id).toBe('p1');
        expect(result.totals.projects).toBe(1);
    });

    it('includes goals completed within the week', async () => {
        vi.mocked(client.fetchGoals).mockResolvedValue([
            makeGoal({ id: 'g1', title: 'Achieved goal', completed: true, completedDate: '2026-02-20' }),
            makeGoal({ id: 'g2', title: 'Ongoing goal', completed: false }),
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.goals).toHaveLength(1);
        expect(result.goals[0].id).toBe('g1');
        expect(result.totals.goals).toBe(1);
    });

    it('returns results sorted by completedDate ascending', async () => {
        vi.mocked(client.fetchTasks).mockResolvedValue([
            makeTask({ id: 't3', completed: true, completedDate: '2026-02-20' }),
            makeTask({ id: 't1', completed: true, completedDate: '2026-02-16' }),
            makeTask({ id: 't2', completed: true, completedDate: '2026-02-18' }),
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.tasks.map(t => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('includes task priority in the result', async () => {
        vi.mocked(client.fetchTasks).mockResolvedValue([
            makeTask({ id: 't1', completed: true, completedDate: '2026-02-17', priority: 'High' }),
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.tasks[0].priority).toBe('High');
    });

    it('handles all three types in the same week', async () => {
        vi.mocked(client.fetchTasks).mockResolvedValue([
            makeTask({ id: 't1', completed: true, completedDate: '2026-02-17' }),
        ] as any);
        vi.mocked(client.fetchProjects).mockResolvedValue([
            makeProject({ id: 'p1', completed: true, completedDate: '2026-02-18' }),
        ] as any);
        vi.mocked(client.fetchGoals).mockResolvedValue([
            makeGoal({ id: 'g1', completed: true, completedDate: '2026-02-19' }),
        ] as any);

        const result = await getWeeklyReview('2026-02-16');
        expect(result.totals).toEqual({ tasks: 1, projects: 1, goals: 1 });
    });

    it('uses the current week when no weekStartStr is provided', async () => {
        const result = await getWeeklyReview();
        // weekStart must be a Monday (dayOfWeek === 1)
        const parsed = Temporal.PlainDate.from(result.weekStart);
        expect(parsed.dayOfWeek).toBe(1);
        // weekEnd must be 6 days after weekStart
        const end = Temporal.PlainDate.from(result.weekEnd);
        expect(parsed.until(end, { largestUnit: 'days' }).days).toBe(6);
    });
});
