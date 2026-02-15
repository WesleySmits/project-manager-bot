/**
 * Morning Briefing Module
 * Generates and sends daily morning briefing with prioritized tasks + "why" explanations
 */
const dayjs = require('dayjs');
const { getTodayTasks } = require('./todayTasks');
const { runHealthCheck } = require('../notion/health');
const { fetchGoals } = require('../notion/client');
const { getTaskInsights } = require('../ai/gemini');

/**
 * Generate morning briefing message with "why" explanations
 * @returns {Promise<string>}
 */
async function generateMorningBriefing() {
    // parallel fetch for performance
    const [tasks, health, goals] = await Promise.all([
        getTodayTasks(3),
        runHealthCheck(),
        fetchGoals()
    ]);

    const lines = [];
    const today = dayjs();

    // 1. HEADER
    lines.push('☀️ *Good morning!*');
    lines.push('');

    // 2. ISSUES (if any)
    const { issues } = health;
    const criticalIssues = [];

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
            const emoji = task.priority?.toLowerCase().includes('high') || task.priority?.toLowerCase().includes('p1') ? '🔴' :
                task.priority?.toLowerCase().includes('medium') || task.priority?.toLowerCase().includes('p2') ? '🟠' : '🟢';

            lines.push(`${i + 1}. ${emoji} *${task.title}*`);
        });
        lines.push('');

        // 4. AI INSIGHTS
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
async function sendMorningBriefing(bot) {
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!CHAT_ID) {
        console.error('⚠️ TELEGRAM_CHAT_ID not set, skipping morning briefing');
        throw new Error('TELEGRAM_CHAT_ID not configured');
    }

    try {
        const message = await generateMorningBriefing();
        await bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log(`✅ Morning briefing sent at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    } catch (err) {
        console.error('❌ Morning briefing error:', err);
        throw err;
    }
}

module.exports = {
    generateMorningBriefing,
    sendMorningBriefing
};
