"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreTask = scoreTask;
exports.getTodayTasks = getTodayTasks;
exports.formatTodayTasks = formatTodayTasks;
/**
 * Today Tasks Command
 * Fetches and scores tasks to show the most important items for today
 */
const dayjs_1 = __importDefault(require("dayjs"));
const client_1 = require("../notion/client");
/**
 * Score a task based on urgency
 * Higher score = more urgent/important
 */
function scoreTask(task) {
    const props = task.properties || {};
    const today = (0, dayjs_1.default)();
    // Due date score (40% weight)
    let dueScore = 0;
    const dueDate = (0, client_1.getDate)(task, 'Due Date') || (0, client_1.getDate)(task, 'Due');
    if (dueDate) {
        const daysUntilDue = (0, dayjs_1.default)(dueDate).diff(today, 'day');
        if (daysUntilDue < 0) {
            // Overdue - maximum urgency
            dueScore = 1.0;
        }
        else if (daysUntilDue === 0) {
            // Due today
            dueScore = 0.95;
        }
        else if (daysUntilDue <= 2) {
            // Due within 2 days
            dueScore = 0.8;
        }
        else if (daysUntilDue <= 7) {
            // Due within a week
            dueScore = 0.5;
        }
        else {
            // Due later - scale down
            dueScore = Math.max(0, 0.3 - (daysUntilDue - 7) * 0.01);
        }
    }
    // Scheduled date score (30% weight)
    let scheduledScore = 0;
    const scheduledDate = (0, client_1.getDate)(task, 'Scheduled');
    if (scheduledDate) {
        const daysUntilScheduled = (0, dayjs_1.default)(scheduledDate).diff(today, 'day');
        if (daysUntilScheduled < 0) {
            // Scheduled in the past - should have been done
            scheduledScore = 1.0;
        }
        else if (daysUntilScheduled === 0) {
            // Scheduled for today - most relevant
            scheduledScore = 0.95;
        }
        else if (daysUntilScheduled === 1) {
            // Tomorrow
            scheduledScore = 0.7;
        }
        else if (daysUntilScheduled <= 3) {
            // Next few days
            scheduledScore = 0.4;
        }
    }
    // Priority score (25% weight)
    let priorityScore = 0;
    const priority = props.Priority?.select?.name?.toLowerCase() || '';
    if (priority.includes('high') || priority.includes('p1') || priority.includes('urgent')) {
        priorityScore = 1.0;
    }
    else if (priority.includes('medium') || priority.includes('p2')) {
        priorityScore = 0.6;
    }
    else if (priority.includes('low') || priority.includes('p3') || priority.includes('p4')) {
        priorityScore = 0.2;
    }
    // Status score (5% weight) - In Progress tasks get a boost
    let statusScore = 0;
    const status = props.Status?.status?.name?.toLowerCase() || '';
    if (status.includes('in progress') || status.includes('doing') || status.includes('active')) {
        statusScore = 1.0;
    }
    else if (status.includes('todo') || status.includes('to do') || status.includes('not started')) {
        statusScore = 0.5;
    }
    // Weighted total
    const score = (0.40 * dueScore) +
        (0.30 * scheduledScore) +
        (0.25 * priorityScore) +
        (0.05 * statusScore);
    return score;
}
/**
 * Get priority emoji
 */
function getPriorityEmoji(priority) {
    if (!priority)
        return '⚪';
    const p = priority.toLowerCase();
    if (p.includes('high') || p.includes('p1') || p.includes('urgent'))
        return '🔴';
    if (p.includes('medium') || p.includes('p2'))
        return '🟠';
    if (p.includes('low') || p.includes('p3') || p.includes('p4'))
        return '🟢';
    return '⚪';
}
/**
 * Format date for display
 */
function formatDate(date) {
    if (!date)
        return null;
    return (0, dayjs_1.default)(date).format('D MMM');
}
/**
 * Get top tasks for today
 * @param {number} limit - Number of tasks to return
 * @returns {Promise<ScoredTask[]>}
 */
async function getTodayTasks(limit = 5) {
    const allTasks = await (0, client_1.fetchTasks)();
    // Filter out completed/canceled tasks
    const activeTasks = allTasks.filter(t => !(0, client_1.isCompleted)(t));
    // Score and sort
    const scoredTasks = activeTasks.map(t => ({
        id: t.id,
        title: (0, client_1.getTitle)(t),
        priority: t.properties?.Priority?.select?.name || undefined,
        status: t.properties?.Status?.status?.name || undefined,
        dueDate: (0, client_1.getDate)(t, 'Due Date') || (0, client_1.getDate)(t, 'Due'),
        scheduledDate: (0, client_1.getDate)(t, 'Scheduled'),
        hasProject: (0, client_1.hasRelation)(t),
        score: scoreTask(t)
    }));
    scoredTasks.sort((a, b) => b.score - a.score);
    return scoredTasks.slice(0, limit);
}
/**
 * Generate dynamic summary of why these tasks matter
 */
function generateTaskSummary(tasks) {
    const today = (0, dayjs_1.default)();
    const lines = [];
    const overdueCount = tasks.filter(t => (t.dueDate && (0, dayjs_1.default)(t.dueDate).isBefore(today, 'day')) ||
        (t.scheduledDate && (0, dayjs_1.default)(t.scheduledDate).isBefore(today, 'day'))).length;
    const highPriorityCount = tasks.filter(t => t.priority?.toLowerCase().includes('high') ||
        t.priority?.toLowerCase().includes('p1')).length;
    const dueTodayCount = tasks.filter(t => t.dueDate && (0, dayjs_1.default)(t.dueDate).isSame(today, 'day')).length;
    const scheduledTodayCount = tasks.filter(t => t.scheduledDate && (0, dayjs_1.default)(t.scheduledDate).isSame(today, 'day')).length;
    lines.push('');
    lines.push('💪 *Completing these will:*');
    if (overdueCount > 0) {
        lines.push(`  • Clear ${overdueCount} overdue item${overdueCount > 1 ? 's' : ''} from your plate`);
    }
    if (dueTodayCount > 0) {
        lines.push(`  • Meet ${dueTodayCount} deadline${dueTodayCount > 1 ? 's' : ''} due today`);
    }
    if (scheduledTodayCount > 0) {
        lines.push(`  • Complete ${scheduledTodayCount} task${scheduledTodayCount > 1 ? 's' : ''} you planned for today`);
    }
    if (highPriorityCount > 0) {
        lines.push(`  • Tackle ${highPriorityCount} high-priority item${highPriorityCount > 1 ? 's' : ''}`);
    }
    if (lines.length === 2) {
        // No specific reasons, give generic motivation
        lines.push('  • Build momentum and reduce mental load');
    }
    return lines.join('\n');
}
/**
 * Format tasks as text message
 */
function formatTodayTasks(tasks) {
    if (tasks.length === 0) {
        return '✅ No urgent tasks! You\'re all caught up.';
    }
    const lines = ['📋 *Your top tasks for today:*', ''];
    const today = (0, dayjs_1.default)();
    tasks.forEach((task, i) => {
        const emoji = getPriorityEmoji(task.priority);
        let dateInfo = '';
        if (task.dueDate) {
            const isOverdue = (0, dayjs_1.default)(task.dueDate).isBefore(today, 'day');
            const isToday = (0, dayjs_1.default)(task.dueDate).isSame(today, 'day');
            dateInfo = `Due: ${formatDate(task.dueDate)}`;
            if (isOverdue)
                dateInfo += ' ⚠️ OVERDUE';
            else if (isToday)
                dateInfo += ' (today)';
        }
        else if (task.scheduledDate) {
            const isOverdue = (0, dayjs_1.default)(task.scheduledDate).isBefore(today, 'day');
            const isToday = (0, dayjs_1.default)(task.scheduledDate).isSame(today, 'day');
            dateInfo = `Scheduled: ${formatDate(task.scheduledDate)}`;
            if (isOverdue)
                dateInfo += ' ⚠️ MISSED';
            else if (isToday)
                dateInfo += ' (today)';
        }
        lines.push(`${i + 1}. ${emoji} *${task.title}*`);
        if (dateInfo)
            lines.push(`   ${dateInfo}`);
    });
    lines.push(generateTaskSummary(tasks));
    return lines.join('\n');
}
