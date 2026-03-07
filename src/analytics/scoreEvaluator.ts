/**
 * Score Evaluator — bridges provider data with the score engine.
 *
 * Called:
 *   1. End-of-day (auto, via scheduler at 23:00 MSK = 20:00 UTC)
 *   2. Next morning (auto, alongside morning briefing at 07:00 MSK)
 *   3. On demand via /score command
 */
import { Temporal } from '@js-temporal/polyfill';
import { getProvider } from '../providers';
import {
    evaluateDay,
    recordDayScore,
    loadScoreState,
    formatScoreMessage,
    ScoreEvent,
    DailyScoreEntry,
} from './score';

/**
 * Evaluate yesterday's productivity and record the score.
 * Called each morning so we know what "yesterday" looked like definitively.
 *
 * A task counts as "planned for day D" if its scheduledDate or dueDate === D.
 * A task counts as "completed on day D" if its status is done AND its
 * last_edited_time falls within day D (Notion-specific heuristic; providers
 * that expose a completedDate should use that instead).
 */
export async function evaluateYesterday(): Promise<DailyScoreEntry | null> {
    const yesterday = Temporal.Now.plainDateISO().subtract({ days: 1 }).toString();
    return evaluateDate(yesterday);
}

/**
 * Evaluate a specific date. Defaults to today.
 * Use this for the /score command or end-of-day snapshot.
 */
export async function evaluateDate(date?: string): Promise<DailyScoreEntry | null> {
    const targetDate = date ?? Temporal.Now.plainDateISO().toString();

    try {
        const provider = getProvider();
        const [allTasks, state] = await Promise.all([
            provider.fetchTasks(),
            loadScoreState(),
        ]);

        // Tasks planned for target date (scheduled OR due on that day)
        const plannedTasks = allTasks.filter(t => {
            return t.scheduledDate === targetDate || t.dueDate === targetDate;
        });

        // Tasks completed — we rely on provider status + raw last_edited_time heuristic
        // A completed task counts for targetDate if:
        //   - status is done/completed/cancelled
        //   - raw last_edited_time starts with targetDate (best proxy without completedDate)
        const completedToday = plannedTasks.filter(t => {
            if (!t.completed) return false;
            const raw = t.raw as any;
            const editedDate = raw?.last_edited_time?.split('T')[0] ?? '';
            return editedDate === targetDate;
        });

        // Missed = planned but not completed
        const missedToday = plannedTasks.filter(t => !t.completed);

        // Total overdue tasks (planned before today, not completed)
        const today = Temporal.Now.plainDateISO().toString();
        const overdueTasks = allTasks.filter(t => {
            if (t.completed) return false;
            const due = t.dueDate ?? t.scheduledDate;
            return due && due < today;
        });

        const events = evaluateDay({
            tasksPlannedForDay: plannedTasks.length,
            tasksCompletedToday: completedToday.length,
            tasksMissedToday: missedToday.length,
            totalOverdueTasks: overdueTasks.length,
            currentStreak: state.streak,
            date: targetDate,
        });

        const entry = await recordDayScore(targetDate, events, {
            tasksPlanned: plannedTasks.length,
            tasksCompleted: completedToday.length,
            tasksMissed: missedToday.length,
            streak: state.streak,
        });

        return entry;
    } catch (err) {
        console.error('Score evaluation error:', err);
        return null;
    }
}

/**
 * Get the current score state + optionally trigger a fresh evaluation.
 */
export async function getCurrentScore(evaluate = false): Promise<{
    state: ReturnType<typeof loadScoreState> extends Promise<infer T> ? T : never;
    latestEntry: DailyScoreEntry | undefined;
    message: string;
}> {
    if (evaluate) await evaluateDate();

    const state = await loadScoreState();
    const today = Temporal.Now.plainDateISO().toString();
    const latestEntry = state.history.find(h => h.date === today)
        ?? state.history[state.history.length - 1];

    return {
        state,
        latestEntry,
        message: formatScoreMessage(state, latestEntry),
    };
}
