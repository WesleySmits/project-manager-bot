/**
 * Productivity Score System
 *
 * A 0-100 score that reflects daily planning and execution quality.
 *
 * The score is not a simple counter — it uses a decaying average so one bad
 * day doesn't tank you permanently, and one great day doesn't max you out.
 *
 * Score formula:
 *   new_score = clamp(old_score + delta, 0, 100)
 *   where delta is the sum of all events for the day.
 *
 * Score also drifts toward 50 (neutral) if no activity is recorded for a day.
 */
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreEvent {
    type: ScoreEventType;
    delta: number;
    description: string;
    /** ISO date YYYY-MM-DD */
    date: string;
    /** ISO datetime */
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export type ScoreEventType =
    | 'task_completed_on_time'     // completed on or before due/scheduled date
    | 'task_completed_late'        // completed after due/scheduled date
    | 'task_missed'                // scheduled for today, not completed
    | 'no_tasks_planned'           // no tasks were planned for the day
    | 'day_well_planned'           // ≥3 tasks planned for the day
    | 'overdue_pile_penalty'       // too many overdue tasks accumulating
    | 'streak_bonus'               // 3+ consecutive good days
    | 'manual_adjustment';         // manual override

export interface DailyScoreEntry {
    date: string;
    /** Score at END of this day (after all events applied) */
    score: number;
    /** Raw delta for this day (sum of all events) */
    delta: number;
    events: ScoreEvent[];
    /** Contextual snapshot for display */
    context: {
        tasksPlanned: number;
        tasksCompleted: number;
        tasksMissed: number;
        streak: number;
    };
}

export interface ScoreState {
    /** Current score (0–100) */
    current: number;
    /** Date of last update */
    lastUpdated: string | null;
    /** Full history */
    history: DailyScoreEntry[];
    /** Current streak (consecutive days with delta >= 0) */
    streak: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export const SCORE_EVENTS: Record<ScoreEventType, { delta: number; label: string }> = {
    task_completed_on_time:  { delta: +8,  label: '✅ Completed task on time' },
    task_completed_late:     { delta: +3,  label: '⏰ Completed task (late)' },
    task_missed:             { delta: -6,  label: '❌ Missed scheduled task' },
    no_tasks_planned:        { delta: -10, label: '📭 No tasks planned for the day' },
    day_well_planned:        { delta: +5,  label: '📋 Day well planned (3+ tasks)' },
    overdue_pile_penalty:    { delta: -1,  label: '⚠️ Overdue pile growing' },
    streak_bonus:            { delta: +3,  label: '🔥 Streak bonus' },
    manual_adjustment:       { delta: 0,   label: '🔧 Manual adjustment' },
};

/** Neutral score to drift toward if no activity is recorded */
const NEUTRAL_SCORE = 50;
/** Drift per idle day toward neutral */
const IDLE_DRIFT = 2;
/** Max single-day delta (prevents gaming) */
const MAX_DAILY_DELTA = 20;
const MIN_DAILY_DELTA = -20;

// ─── Storage ──────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const SCORE_FILE = path.join(DATA_DIR, 'productivity_score.json');

async function ensureDir() {
    try { await fs.access(DATA_DIR); } catch { await fs.mkdir(DATA_DIR, { recursive: true }); }
}

export async function loadScoreState(): Promise<ScoreState> {
    try {
        const data = await fs.readFile(SCORE_FILE, 'utf-8');
        return JSON.parse(data) as ScoreState;
    } catch {
        return { current: 50, lastUpdated: null, history: [], streak: 0 };
    }
}

export async function saveScoreState(state: ScoreState): Promise<void> {
    await ensureDir();
    await fs.writeFile(SCORE_FILE, JSON.stringify(state, null, 2));
}

// ─── Score Engine ─────────────────────────────────────────────────────────────

/**
 * Clamp a value to [min, max]
 */
function clamp(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, val));
}

/**
 * Apply idle drift: if days have passed without any entry, drift toward neutral.
 */
function applyIdleDrift(state: ScoreState, today: string): number {
    if (!state.lastUpdated || state.lastUpdated === today) return state.current;

    const last = new Date(state.lastUpdated);
    const now = new Date(today);
    const idleDays = Math.floor((now.getTime() - last.getTime()) / 86_400_000);

    if (idleDays <= 0) return state.current;

    let score = state.current;
    for (let i = 0; i < idleDays; i++) {
        if (score > NEUTRAL_SCORE) score = Math.max(NEUTRAL_SCORE, score - IDLE_DRIFT);
        else if (score < NEUTRAL_SCORE) score = Math.min(NEUTRAL_SCORE, score + IDLE_DRIFT);
    }
    return Math.round(score);
}

/**
 * Compute the delta for a day given its events.
 * Caps the total delta to prevent gaming.
 */
export function computeDelta(events: ScoreEvent[]): number {
    const raw = events.reduce((sum, e) => sum + e.delta, 0);
    return clamp(raw, MIN_DAILY_DELTA, MAX_DAILY_DELTA);
}

/**
 * Calculate the current streak from history.
 * Streak = consecutive days where delta >= 0 (ending with today or yesterday).
 */
function calculateStreak(history: DailyScoreEntry[], today: string): number {
    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    let expected = today;

    for (const entry of sorted) {
        if (entry.date !== expected) break;
        if (entry.delta < 0) break;
        streak++;
        // Move to previous day
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().split('T')[0];
    }
    return streak;
}

/**
 * Record the day's score events. Call this once per day (e.g. end-of-day or next morning).
 * Idempotent: calling twice for the same date overwrites the previous entry.
 */
export async function recordDayScore(
    date: string,
    events: ScoreEvent[],
    context: DailyScoreEntry['context'],
): Promise<DailyScoreEntry> {
    const state = await loadScoreState();

    // Apply idle drift for any missed days
    const driftedScore = applyIdleDrift(state, date);

    // Compute this day's delta
    const delta = computeDelta(events);
    const newScore = clamp(driftedScore + delta, 0, 100);

    // Calculate streak
    // Include this day in history for streak calc
    const historyWithoutToday = state.history.filter(h => h.date !== date);
    const streak = calculateStreak([...historyWithoutToday, { date, delta, score: newScore, events, context }], date);

    const entry: DailyScoreEntry = {
        date,
        score: newScore,
        delta,
        events,
        context,
    };

    // Update state
    state.current = newScore;
    state.lastUpdated = date;
    state.streak = streak;
    state.history = [...historyWithoutToday, entry].sort((a, b) => a.date.localeCompare(b.date));
    // Keep last 90 days
    if (state.history.length > 90) state.history = state.history.slice(-90);

    await saveScoreState(state);
    return entry;
}

/**
 * Manual score adjustment (for testing or admin overrides).
 */
export async function manualAdjustScore(delta: number, reason: string, date?: string): Promise<DailyScoreEntry> {
    const today = date ?? new Date().toISOString().split('T')[0];
    const event: ScoreEvent = {
        type: 'manual_adjustment',
        delta,
        description: reason,
        date: today,
        timestamp: new Date().toISOString(),
    };
    return recordDayScore(today, [event], {
        tasksPlanned: 0,
        tasksCompleted: 0,
        tasksMissed: 0,
        streak: 0,
    });
}

// ─── Score Evaluator ──────────────────────────────────────────────────────────

/**
 * Evaluate a day's productivity and return the events to record.
 * Call this at end-of-day or the following morning.
 *
 * @param tasksPlannedForDay  - tasks that were scheduled/due today
 * @param tasksCompletedToday - tasks actually completed today
 * @param totalOverdueTasks   - total overdue task count (not just today's)
 * @param date                - ISO date to evaluate (defaults to today)
 */
export function evaluateDay(params: {
    tasksPlannedForDay: number;
    tasksCompletedToday: number;
    tasksMissedToday: number;
    totalOverdueTasks: number;
    currentStreak: number;
    date?: string;
}): ScoreEvent[] {
    const {
        tasksPlannedForDay,
        tasksCompletedToday,
        tasksMissedToday,
        totalOverdueTasks,
        currentStreak,
        date = new Date().toISOString().split('T')[0],
    } = params;

    const events: ScoreEvent[] = [];
    const ts = new Date().toISOString();

    // No planning penalty
    if (tasksPlannedForDay === 0) {
        events.push({
            type: 'no_tasks_planned',
            delta: SCORE_EVENTS.no_tasks_planned.delta,
            description: 'No tasks were planned for today',
            date,
            timestamp: ts,
            metadata: { tasksPlannedForDay },
        });
    } else {
        // Planning bonus
        if (tasksPlannedForDay >= 3) {
            events.push({
                type: 'day_well_planned',
                delta: SCORE_EVENTS.day_well_planned.delta,
                description: `${tasksPlannedForDay} tasks planned for today`,
                date,
                timestamp: ts,
                metadata: { tasksPlannedForDay },
            });
        }

        // Completion rewards
        for (let i = 0; i < tasksCompletedToday; i++) {
            events.push({
                type: 'task_completed_on_time',
                delta: SCORE_EVENTS.task_completed_on_time.delta,
                description: 'Task completed on time',
                date,
                timestamp: ts,
            });
        }

        // Miss penalties
        for (let i = 0; i < tasksMissedToday; i++) {
            events.push({
                type: 'task_missed',
                delta: SCORE_EVENTS.task_missed.delta,
                description: 'Scheduled task not completed',
                date,
                timestamp: ts,
            });
        }
    }

    // Overdue pile penalty (only for pile > 5)
    const excessOverdue = Math.max(0, totalOverdueTasks - 5);
    if (excessOverdue > 0) {
        events.push({
            type: 'overdue_pile_penalty',
            delta: -excessOverdue,
            description: `${totalOverdueTasks} overdue tasks (${excessOverdue} excess)`,
            date,
            timestamp: ts,
            metadata: { totalOverdueTasks, excessOverdue },
        });
    }

    // Streak bonus (if 2+ consecutive good days before today)
    if (currentStreak >= 2) {
        events.push({
            type: 'streak_bonus',
            delta: SCORE_EVENTS.streak_bonus.delta,
            description: `${currentStreak + 1}-day streak`,
            date,
            timestamp: ts,
            metadata: { streak: currentStreak + 1 },
        });
    }

    return events;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Get a label for the current score
 */
export function getScoreLabel(score: number): string {
    if (score >= 85) return '🏆 Outstanding';
    if (score >= 70) return '🌟 Great';
    if (score >= 55) return '👍 Good';
    if (score >= 40) return '😐 Neutral';
    if (score >= 25) return '😟 Struggling';
    return '🆘 Critical';
}

/**
 * Format score for Telegram display
 */
export function formatScoreMessage(state: ScoreState, latestEntry?: DailyScoreEntry): string {
    const label = getScoreLabel(state.current);
    const bar = buildProgressBar(state.current);
    const streakText = state.streak > 1 ? ` 🔥 ${state.streak}-day streak` : '';

    const lines = [
        `📊 *Productivity Score*`,
        ``,
        `${bar} *${state.current}/100*`,
        `${label}${streakText}`,
        ``,
    ];

    if (latestEntry && latestEntry.events.length > 0) {
        lines.push(`*Today's events:*`);
        for (const event of latestEntry.events) {
            const sign = event.delta >= 0 ? '+' : '';
            lines.push(`  ${sign}${event.delta} — ${event.description}`);
        }
        lines.push(`  ─────`);
        const sign = latestEntry.delta >= 0 ? '+' : '';
        lines.push(`  ${sign}${latestEntry.delta} net delta`);
    }

    return lines.join('\n');
}

function buildProgressBar(score: number, width = 10): string {
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
}
