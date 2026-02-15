/**
 * Morning Briefing Module
 * Generates and sends daily morning briefing with prioritized tasks + "why" explanations
 */
import { Telegraf, Context } from 'telegraf';
import { Temporal } from '@js-temporal/polyfill';
import { getTodayTasks } from './todayTasks';
import { runHealthCheck } from '../notion/health';
import { fetchGoals } from '../notion/client';
import { getTaskInsights } from '../ai/gemini';

/**
 * Generate morning briefing message with "why" explanations
 * @returns {Promise<string>}
 */
export async function generateMorningBriefing(): Promise<string> {
    // parallel fetch for performance
    const [tasks, health, goals] = await Promise.all([
        getTodayTasks(3),
        runHealthCheck(),
        fetchGoals()
    ]);

    const lines: string[] = [];

    // 1. HEADER
    lines.push('☀️ *Good morning!*');
    lines.push('');

    // 2. ISSUES (if any)
    const { issues } = health;
    const criticalIssues: string[] = [];

    if (issues.orphanedTasks.length > 0) criticalIssues.push(`${issues.orphanedTasks.length} orphaned tasks`);
    if (issues.projectsWithoutGoal.length > 0) criticalIssues.push(`${issues.projectsWithoutGoal.length} projects w/o goal`);
    if (issues.overdueDueDate.length > 0) criticalIssues.push(`${issues.overdueDueDate.length} overdue tasks`);

    if (criticalIssues.length > 0) {
        lines.push('🚨 *Attention Needed:*');
        lines.push(`You have ${criticalIssues.join(', ')} to fix in Notion.`);
        lines.push('');
    }

    // 3. PRIORITIES
    if (tasks.length === 0) {
        lines.push('✨ No urgent tasks today. Great time for deep work or strategic planning.');
    } else {
        lines.push('🎯 *Top 3 Priorities:*');
        tasks.forEach((task, i) => {
            // Priority emoji
            const priority = task.priority || '';
            const emoji = priority.toLowerCase().includes('high') || priority.toLowerCase().includes('p1') ? '🔴' :
                priority.toLowerCase().includes('medium') || priority.toLowerCase().includes('p2') ? '🟠' : '🟢';

            lines.push(`${i + 1}. ${emoji} *${task.title}*`);
        });
        lines.push('');

        // 4. AI INSIGHTS
        // Cast tasks and goals to match the interfaces expected by Gemini (simple mapping if needed)
        const insights = await getTaskInsights(tasks, goals);
        lines.push('🧠 *Insight:*');
        lines.push(`_${insights}_`);
    }

    return lines.join('\n');
}

/**
 * Send morning briefing to configured Telegram chat
 * @param {Telegraf} bot - Telegram bot instance
 * @returns {Promise<void>}
 */
export async function sendMorningBriefing(bot: Telegraf): Promise<void> {
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!CHAT_ID) {
        console.error('⚠️ TELEGRAM_CHAT_ID not set, skipping morning briefing');
        throw new Error('TELEGRAM_CHAT_ID not configured');
    }

    try {
        const message = await generateMorningBriefing();
        await bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
        const timestamp = Temporal.Now.plainDateTimeISO().toString().replace('T', ' ').split('.')[0];
        console.log(`✅ Morning briefing sent at ${timestamp}`);
    } catch (err) {
        console.error('❌ Morning briefing error:', err);
        throw err;
    }
}

/**
 * Handle /morning command
 */
export async function handleMorningBriefing(ctx: Context): Promise<void> {
    try {
        await ctx.replyWithChatAction('typing');
        const message = await generateMorningBriefing();
        await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error('Morning brief command error:', err);
        await ctx.reply('❌ Failed to generate morning briefing.');
    }
}
