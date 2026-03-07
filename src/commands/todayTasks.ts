/**
 * Today Tasks Command
 * Fetches and scores tasks to show the most important items for today
 */
import { Temporal } from '@js-temporal/polyfill';
import { getProvider, Task } from '../providers';

interface ScoredTask {
    id: string;
    title: string;
    priority: string | undefined;
    status: string | undefined;
    dueDate: string | null;
    scheduledDate: string | null;
    hasProject: boolean;
    score: number;
}

/**
 * Score a task based on urgency
 * Higher score = more urgent/important
 */
export function scoreTask(task: Task): number {
    const today = Temporal.Now.plainDateISO();

    // Due date score (40% weight)
    let dueScore = 0;
    const dueDate = task.dueDate;
    if (dueDate) {
        const daysUntilDue = Temporal.PlainDate.from(dueDate).since(today).days;
        if (daysUntilDue < 0) {
            dueScore = 1.0;
        } else if (daysUntilDue === 0) {
            dueScore = 0.95;
        } else if (daysUntilDue <= 2) {
            dueScore = 0.8;
        } else if (daysUntilDue <= 7) {
            dueScore = 0.5;
        } else {
            dueScore = Math.max(0, 0.3 - (daysUntilDue - 7) * 0.01);
        }
    }

    // Scheduled date score (30% weight)
    let scheduledScore = 0;
    const scheduledDate = task.scheduledDate;
    if (scheduledDate) {
        const daysUntilScheduled = Temporal.PlainDate.from(scheduledDate).since(today).days;
        if (daysUntilScheduled < 0) {
            scheduledScore = 1.0;
        } else if (daysUntilScheduled === 0) {
            scheduledScore = 0.95;
        } else if (daysUntilScheduled === 1) {
            scheduledScore = 0.7;
        } else if (daysUntilScheduled <= 3) {
            scheduledScore = 0.4;
        }
    }

    // Priority score (25% weight)
    let priorityScore = 0;
    const priority = (task.priority ?? '').toLowerCase();
    if (priority.includes('high') || priority.includes('p1') || priority.includes('urgent')) {
        priorityScore = 1.0;
    } else if (priority.includes('medium') || priority.includes('p2')) {
        priorityScore = 0.6;
    } else if (priority.includes('low') || priority.includes('p3') || priority.includes('p4')) {
        priorityScore = 0.2;
    }

    // Status score (5% weight) - In Progress tasks get a boost
    let statusScore = 0;
    const status = (task.status ?? '').toLowerCase();
    if (status.includes('in progress') || status.includes('doing') || status.includes('active')) {
        statusScore = 1.0;
    } else if (status.includes('todo') || status.includes('to do') || status.includes('not started')) {
        statusScore = 0.5;
    }

    return (0.40 * dueScore) + (0.30 * scheduledScore) + (0.25 * priorityScore) + (0.05 * statusScore);
}

/**
 * Get priority emoji
 */
function getPriorityEmoji(priority: string | null | undefined): string {
    if (!priority) return '⚪';
    const p = priority.toLowerCase();
    if (p.includes('high') || p.includes('p1') || p.includes('urgent')) return '🔴';
    if (p.includes('medium') || p.includes('p2')) return '🟠';
    if (p.includes('low') || p.includes('p3') || p.includes('p4')) return '🟢';
    return '⚪';
}

/**
 * Format date for display
 */
function formatDate(date: string | null): string | null {
    if (!date) return null;
    return Temporal.PlainDate.from(date).toLocaleString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Get top tasks for today
 */
export async function getTodayTasks(limit: number = 5): Promise<ScoredTask[]> {
    const provider = getProvider();
    const allTasks = await provider.fetchTasks();

    // fetchTasks() should already exclude completed tasks, but guard anyway
    const activeTasks = allTasks.filter(t => !t.completed);

    const scoredTasks: ScoredTask[] = activeTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority ?? undefined,
        status: t.status ?? undefined,
        dueDate: t.dueDate,
        scheduledDate: t.scheduledDate,
        hasProject: t.projectId !== null,
        score: scoreTask(t),
    }));

    scoredTasks.sort((a, b) => b.score - a.score);
    return scoredTasks.slice(0, limit);
}

/**
 * Generate dynamic summary of why these tasks matter
 */
function generateTaskSummary(tasks: ScoredTask[]): string {
    const today = Temporal.Now.plainDateISO();
    const lines: string[] = [];

    const overdueCount = tasks.filter(t =>
        (t.dueDate && Temporal.PlainDate.compare(Temporal.PlainDate.from(t.dueDate), today) < 0) ||
        (t.scheduledDate && Temporal.PlainDate.compare(Temporal.PlainDate.from(t.scheduledDate), today) < 0)
    ).length;

    const highPriorityCount = tasks.filter(t =>
        t.priority?.toLowerCase().includes('high') ||
        t.priority?.toLowerCase().includes('p1')
    ).length;

    const dueTodayCount = tasks.filter(t =>
        t.dueDate && Temporal.PlainDate.from(t.dueDate).equals(today)
    ).length;

    const scheduledTodayCount = tasks.filter(t =>
        t.scheduledDate && Temporal.PlainDate.from(t.scheduledDate).equals(today)
    ).length;

    lines.push('');
    lines.push('💪 *Completing these will:*');

    if (overdueCount > 0) lines.push(`  • Clear ${overdueCount} overdue item${overdueCount > 1 ? 's' : ''} from your plate`);
    if (dueTodayCount > 0) lines.push(`  • Meet ${dueTodayCount} deadline${dueTodayCount > 1 ? 's' : ''} due today`);
    if (scheduledTodayCount > 0) lines.push(`  • Complete ${scheduledTodayCount} task${scheduledTodayCount > 1 ? 's' : ''} you planned for today`);
    if (highPriorityCount > 0) lines.push(`  • Tackle ${highPriorityCount} high-priority item${highPriorityCount > 1 ? 's' : ''}`);
    if (lines.length === 2) lines.push('  • Build momentum and reduce mental load');

    return lines.join('\n');
}

/**
 * Format tasks as text message
 */
export function formatTodayTasks(tasks: ScoredTask[]): string {
    if (tasks.length === 0) return '✅ No urgent tasks! You\'re all caught up.';

    const lines = ['📋 *Your top tasks for today:*', ''];
    const today = Temporal.Now.plainDateISO();

    tasks.forEach((task, i) => {
        const emoji = getPriorityEmoji(task.priority);
        let dateInfo = '';

        if (task.dueDate) {
            const d = Temporal.PlainDate.from(task.dueDate);
            const isOverdue = Temporal.PlainDate.compare(d, today) < 0;
            const isToday = d.equals(today);
            dateInfo = `Due: ${formatDate(task.dueDate)}`;
            if (isOverdue) dateInfo += ' ⚠️ OVERDUE';
            else if (isToday) dateInfo += ' (today)';
        } else if (task.scheduledDate) {
            const d = Temporal.PlainDate.from(task.scheduledDate);
            const isOverdue = Temporal.PlainDate.compare(d, today) < 0;
            const isToday = d.equals(today);
            dateInfo = `Scheduled: ${formatDate(task.scheduledDate)}`;
            if (isOverdue) dateInfo += ' ⚠️ MISSED';
            else if (isToday) dateInfo += ' (today)';
        }

        lines.push(`${i + 1}. ${emoji} *${task.title}*`);
        if (dateInfo) lines.push(`   ${dateInfo}`);
    });

    lines.push(generateTaskSummary(tasks));
    return lines.join('\n');
}
