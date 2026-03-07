/**
 * Morning Briefing Module
 * Generates and sends daily morning briefing with prioritized tasks + "why" explanations
 */
import { Telegraf, Context } from 'telegraf';
import { Temporal } from '@js-temporal/polyfill';
import { getTodayTasks } from './todayTasks';
import { getProvider } from '../providers';
import { getTaskInsights } from '../ai/gemini';

// Health check is provider-specific — import separately only if Notion is active,
// falling back to provider.healthCheck() otherwise.
async function getHealthIssues(): Promise<{ orphanedTasks: number; projectsWithoutGoal: number; overdueTasks: number }> {
    try {
        // Try Notion-specific health check for richer data
        const { runHealthCheck } = await import('../notion/health');
        const health = await runHealthCheck();
        return {
            orphanedTasks: health.issues.orphanedTasks.length,
            projectsWithoutGoal: health.issues.projectsWithoutGoal.length,
            overdueTasks: health.issues.overdueDueDate.length,
        };
    } catch {
        // Fallback: use provider health check
        const result = await getProvider().healthCheck();
        const overdue = result.issues.filter(i => i.message.toLowerCase().includes('overdue')).length;
        return {
            orphanedTasks: 0,
            projectsWithoutGoal: 0,
            overdueTasks: overdue,
        };
    }
}

/**
 * Generate morning briefing message with "why" explanations
 */
export async function generateMorningBriefing(): Promise<string> {
    const provider = getProvider();

    const [tasks, healthData, goals] = await Promise.all([
        getTodayTasks(3),
        getHealthIssues(),
        provider.fetchGoals(),
    ]);

    const lines: string[] = [];

    // 1. HEADER
    lines.push('☀️ *Good morning!*');
    lines.push('');

    // 2. ISSUES (if any)
    const criticalIssues: string[] = [];
    if (healthData.orphanedTasks > 0) criticalIssues.push(`${healthData.orphanedTasks} orphaned tasks`);
    if (healthData.projectsWithoutGoal > 0) criticalIssues.push(`${healthData.projectsWithoutGoal} projects w/o goal`);
    if (healthData.overdueTasks > 0) criticalIssues.push(`${healthData.overdueTasks} overdue tasks`);

    if (criticalIssues.length > 0) {
        lines.push('🚨 *Attention Needed:*');
        lines.push(`You have ${criticalIssues.join(', ')} to address.`);
        lines.push('');
    }

    // 3. PRIORITIES
    if (tasks.length === 0) {
        lines.push('✨ No urgent tasks today. Great time for deep work or strategic planning.');
    } else {
        lines.push('🎯 *Top 3 Priorities:*');
        tasks.forEach((task, i) => {
            const priority = task.priority || '';
            const emoji = priority.toLowerCase().includes('high') || priority.toLowerCase().includes('p1') ? '🔴' :
                priority.toLowerCase().includes('medium') || priority.toLowerCase().includes('p2') ? '🟠' : '🟢';
            lines.push(`${i + 1}. ${emoji} *${task.title}*`);
        });
        lines.push('');

        // 4. AI INSIGHTS
        const insights = await getTaskInsights(
            tasks.map(t => ({ title: t.title, priority: t.priority })),
            goals.map(g => ({ title: g.title })),
        );
        lines.push('🧠 *Insight:*');
        lines.push(`_${insights}_`);
    }

    return lines.join('\n');
}

/**
 * Send morning briefing to configured Telegram chat
 */
export async function sendMorningBriefing(bot: Telegraf): Promise<void> {
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    if (!CHAT_ID) throw new Error('TELEGRAM_CHAT_ID not configured');

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
