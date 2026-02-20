/**
 * Weekly Review — fetch all tasks, projects, and goals completed in a given week.
 *
 * Rules:
 * - Week is Monday–Sunday (ISO week).
 * - Completion is determined by `Completed Date` property (date type).
 * - Status-based completion (isCompleted) is used as a secondary guard.
 * - `weekStart` must be a Monday in YYYY-MM-DD format. Defaults to current week's Monday.
 */

import { Temporal } from '@js-temporal/polyfill';
import {
    fetchTasks,
    fetchProjects,
    fetchGoals,
    getTitle,
    getDate,
    isCompleted,
    NotionPage,
} from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompletedTask {
    id: string;
    title: string;
    completedDate: string;
    priority: string | null;
    url: string;
}

export interface CompletedProject {
    id: string;
    title: string;
    completedDate: string;
    url: string;
}

export interface CompletedGoal {
    id: string;
    title: string;
    completedDate: string;
    url: string;
}

export interface WeeklyReviewResult {
    weekStart: string;   // Monday YYYY-MM-DD
    weekEnd: string;     // Sunday YYYY-MM-DD
    tasks: CompletedTask[];
    projects: CompletedProject[];
    goals: CompletedGoal[];
    totals: {
        tasks: number;
        projects: number;
        goals: number;
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a YYYY-MM-DD string into a Temporal.PlainDate.
 * Returns null if the string is null, empty, or invalid.
 */
export function parsePlainDate(dateStr: string | null): Temporal.PlainDate | null {
    if (!dateStr) return null;
    try {
        return Temporal.PlainDate.from(dateStr);
    } catch {
        return null;
    }
}

/**
 * Derive the Monday of the ISO week that contains `date`.
 */
export function getMondayOf(date: Temporal.PlainDate): Temporal.PlainDate {
    // dayOfWeek: 1 = Monday … 7 = Sunday
    return date.subtract({ days: date.dayOfWeek - 1 });
}

/**
 * Return the Monday of the current ISO week (UTC).
 */
export function currentWeekMonday(): Temporal.PlainDate {
    return getMondayOf(Temporal.Now.plainDateISO());
}

/**
 * Return true iff `date` falls within [weekStart, weekStart+6] inclusive.
 */
export function isInWeek(date: Temporal.PlainDate, weekStart: Temporal.PlainDate): boolean {
    const weekEnd = weekStart.add({ days: 6 });
    return (
        Temporal.PlainDate.compare(date, weekStart) >= 0 &&
        Temporal.PlainDate.compare(date, weekEnd) <= 0
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch the weekly review for the ISO week starting on `weekStartStr` (Monday).
 *
 * @param weekStartStr  Optional YYYY-MM-DD Monday. Defaults to the current week's Monday.
 * @returns             WeeklyReviewResult with completed tasks, projects, and goals.
 * @throws              If `weekStartStr` is not a Monday.
 */
export async function getWeeklyReview(weekStartStr?: string): Promise<WeeklyReviewResult> {
    // Resolve + validate weekStart
    let weekStart: Temporal.PlainDate;

    if (weekStartStr) {
        const parsed = parsePlainDate(weekStartStr);
        if (!parsed) throw new Error(`Invalid date: "${weekStartStr}". Expected YYYY-MM-DD.`);
        if (parsed.dayOfWeek !== 1) {
            throw new Error(`"${weekStartStr}" is not a Monday (dayOfWeek=${parsed.dayOfWeek}). Weekly reviews start on Monday.`);
        }
        weekStart = parsed;
    } else {
        weekStart = currentWeekMonday();
    }

    const weekEnd = weekStart.add({ days: 6 });

    // Fetch all three databases in parallel
    const [tasks, projects, goals] = await Promise.all([
        fetchTasks(),
        fetchProjects(),
        fetchGoals(),
    ]);

    // ── Tasks ────────────────────────────────────────────────────────────────
    const completedTasks: CompletedTask[] = tasks
        .filter(t => {
            if (!isCompleted(t)) return false;
            const d = parsePlainDate(getDate(t, 'Completed Date'));
            return d !== null && isInWeek(d, weekStart);
        })
        .map((t): CompletedTask => ({
            id: t.id,
            title: getTitle(t),
            completedDate: getDate(t, 'Completed Date')!,
            priority: t.properties?.Priority?.select?.name ?? null,
            url: t.url,
        }))
        .sort((a, b) => a.completedDate.localeCompare(b.completedDate));

    // ── Projects ─────────────────────────────────────────────────────────────
    const completedProjects: CompletedProject[] = projects
        .filter(p => {
            if (!isCompleted(p)) return false;
            const d = parsePlainDate(getDate(p, 'Completed Date'));
            return d !== null && isInWeek(d, weekStart);
        })
        .map((p): CompletedProject => ({
            id: p.id,
            title: getTitle(p),
            completedDate: getDate(p, 'Completed Date')!,
            url: p.url,
        }))
        .sort((a, b) => a.completedDate.localeCompare(b.completedDate));

    // ── Goals ─────────────────────────────────────────────────────────────────
    const completedGoals: CompletedGoal[] = goals
        .filter(g => {
            if (!isCompleted(g)) return false;
            const d = parsePlainDate(getDate(g, 'Completed Date'));
            return d !== null && isInWeek(d, weekStart);
        })
        .map((g): CompletedGoal => ({
            id: g.id,
            title: getTitle(g),
            completedDate: getDate(g, 'Completed Date')!,
            url: g.url,
        }))
        .sort((a, b) => a.completedDate.localeCompare(b.completedDate));

    return {
        weekStart: weekStart.toString(),
        weekEnd: weekEnd.toString(),
        tasks: completedTasks,
        projects: completedProjects,
        goals: completedGoals,
        totals: {
            tasks: completedTasks.length,
            projects: completedProjects.length,
            goals: completedGoals.length,
        },
    };
}
