import { getProvider, Task, Project } from '../providers';
import { AnalyticsSnapshot, saveSnapshot } from './store';
import { Temporal } from '@js-temporal/polyfill';

/**
 * Helper to parse dates safely
 */
function parseDate(dateStr: string | null): Temporal.PlainDate | null {
    if (!dateStr) return null;
    try {
        return Temporal.PlainDate.from(dateStr);
    } catch {
        return null;
    }
}

/**
 * Calculate days between two dates
 */
function daysBetween(start: Temporal.PlainDate, end: Temporal.PlainDate): number {
    return start.until(end, { largestUnit: 'days' }).days;
}

export async function collectDailyMetrics(): Promise<AnalyticsSnapshot> {
    const provider = getProvider();
    const [tasks, projects] = await Promise.all([provider.fetchTasks(), provider.fetchProjects()]);

    const now = Temporal.Now.plainDateISO();
    const todayStr = now.toString();

    // Time ranges
    const startOfWeek = now.subtract({ days: now.dayOfWeek - 1 }); // Monday
    const startOfMonth = now.with({ day: 1 });

    // 1. Completion Counts
    const completedTasks = tasks.filter(t => t.completed);
    const completedProjects = projects.filter(p => p.statusCategory === 'DONE');

    const tasksCompletedToday = completedTasks.filter(t => {
        const date = parseDate((t.raw as any)?.['Completed Date']?.date?.start ?? null); // Ensure 'Completed Date' property exists in Notion
        return date && date.equals(now);
    }).length;

    const tasksCompletedThisWeek = completedTasks.filter(t => {
        const date = parseDate((t.raw as any)?.['Completed Date']?.date?.start ?? null);
        return date && Temporal.PlainDate.compare(date, startOfWeek) >= 0;
    }).length;

    const tasksCompletedThisMonth = completedTasks.filter(t => {
        const date = parseDate((t.raw as any)?.['Completed Date']?.date?.start ?? null);
        return date && Temporal.PlainDate.compare(date, startOfMonth) >= 0;
    }).length;

    const projectsCompletedThisWeek = completedProjects.filter(p => {
        const date = parseDate((p.raw as any)?.['Completed Date']?.date?.start ?? null);
        return date && Temporal.PlainDate.compare(date, startOfWeek) >= 0;
    }).length;

    const projectsCompletedThisMonth = completedProjects.filter(p => {
        const date = parseDate((p.raw as any)?.['Completed Date']?.date?.start ?? null);
        return date && Temporal.PlainDate.compare(date, startOfMonth) >= 0;
    }).length;

    // 2. Averages (Time to Completion)
    // Formula: Completed Date - Created Time (or 'Activated Date' if we want cycle time)
    // User requested: "Average time-to-completion (Tasks: Total Days to Completion)"
    // The user mentioned "Total Days to Completion" is a formula property. We can try to read it directly if it's exposed.
    // However, formulas often return values that need parsing.
    // If we can't read the formula easily, we calculate it: Completed Date - Created Time

    // Let's try to calculate manually for consistency if formula access is tricky or verify with property check
    // Actually, user said properties exist: "Total Days to Completion".
    // But reading formula values via API can be tricky (type 'formula').
    // Let's calculate it manually to be safe: Completed Date - Created Date (or Activated Date)

    let totalTaskDays = 0;
    let taskCountForAvg = 0;

    // We'll use a window of last 30 days for averages to keep it relevant?
    // Or all time? "Average time-to-completion" usually implies recently completed or all.
    // Let's stick to "completed this month" for the average to make it a current metric,
    // or maybe last 30 completed tasks.
    // Let's do: Tasks completed in the last 30 days to get a moving average.

    const thirtyDaysAgo = now.subtract({ days: 30 });
    const recentCompletedTasks = completedTasks.filter(t => {
        const date = parseDate((t.raw as any)?.['Completed Date']?.date?.start ?? null);
        return date && Temporal.PlainDate.compare(date, thirtyDaysAgo) >= 0;
    });

    for (const t of recentCompletedTasks) {
        const created = parseDate((t.raw as any)?.['Created Time']?.created_time?.split('T')[0] ?? null);
        const completed = parseDate((t.raw as any)?.['Completed Date']?.date?.start ?? null);

        if (created && completed) {
            const days = daysBetween(created, completed);
            if (days >= 0) {
                totalTaskDays += days;
                taskCountForAvg++;
            }
        }
    }

    const avgTaskCompletionDays = taskCountForAvg > 0 ? Math.round(totalTaskDays / taskCountForAvg) : 0;

    // Projects Average
    let totalProjectDays = 0;
    let projectCountForAvg = 0;
    const recentCompletedProjects = completedProjects.filter(p => {
        const date = parseDate((p.raw as any)?.['Completed Date']?.date?.start ?? null);
        return date && Temporal.PlainDate.compare(date, thirtyDaysAgo) >= 0;
    });

    for (const p of recentCompletedProjects) {
         const created = parseDate((p.raw as any)?.['Created Time']?.created_time?.split('T')[0] ?? null);
         const completed = parseDate((p.raw as any)?.['Completed Date']?.date?.start ?? null);
         if (created && completed) {
             const days = daysBetween(created, completed);
             if (days >= 0) {
                 totalProjectDays += days;
                 projectCountForAvg++;
             }
         }
    }
    const avgProjectCompletionDays = projectCountForAvg > 0 ? Math.round(totalProjectDays / projectCountForAvg) : 0;

    // 3. Active Status Metrics
    const activeTasks = tasks.filter(t => !t.completed && t.status !== 'Not started');
    // Assuming "Not started" or similar is the initial state.
    // "Active" usually means "In Progress".

    let totalActiveDays = 0;
    let activeTaskCountForAvg = 0;
    let stuckTasksCount = 0; // Active > 7 days

    for (const t of activeTasks) {
        // "Days in Active" logic.
        // User has "Activated Date".
        const activated = parseDate((t.raw as any)?.['Activated Date']?.date?.start ?? null);
        if (activated) {
            const days = daysBetween(activated, now);
            if (days >= 0) {
                totalActiveDays += days;
                activeTaskCountForAvg++;
                if (days > 7) stuckTasksCount++;
            }
        }
    }

    const avgTaskActiveDays = activeTaskCountForAvg > 0 ? Math.round(totalActiveDays / activeTaskCountForAvg) : 0;

    const snapshot: AnalyticsSnapshot = {
        date: todayStr,
        timestamp: new Date().toISOString(),
        metrics: {
            tasksCompletedToday,
            tasksCompletedThisWeek,
            tasksCompletedThisMonth,
            projectsCompletedThisWeek,
            projectsCompletedThisMonth,
            avgTaskCompletionDays,
            avgProjectCompletionDays,
            avgTaskActiveDays,
            activeTasksCount: stuckTasksCount,
            activeProjectsCount: projects.filter(p => p.active).length
        }
    };

    await saveSnapshot(snapshot);
    return snapshot;
}
