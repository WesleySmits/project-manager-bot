/**
 * Morning Briefing Module
 * Generates and sends daily morning briefing with prioritized tasks + "why" explanations
 */
const dayjs = require('dayjs');
const { getTodayTasks } = require('./todayTasks');

/**
 * Generate morning briefing message with "why" explanations
 * @returns {Promise<string>}
 */
async function generateMorningBriefing() {
    const tasks = await getTodayTasks(3); // Top 3 tasks
    
    if (tasks.length === 0) {
        return '✨ *Good morning!*\n\nNo urgent tasks today. Great time for deep work or strategic planning.';
    }

    const lines = ['☀️ *Good morning! Here are your top 3 priorities:*\n'];
    const today = dayjs();

    tasks.forEach((task, i) => {
        // Priority emoji
        const emoji = task.priority?.toLowerCase().includes('high') || task.priority?.toLowerCase().includes('p1') ? '🔴' :
                      task.priority?.toLowerCase().includes('medium') || task.priority?.toLowerCase().includes('p2') ? '🟠' : '🟢';
        
        // Build "why" explanation based on scoring factors
        let why = '';
        
        if (task.dueDate && dayjs(task.dueDate).isBefore(today, 'day')) {
            const daysLate = today.diff(dayjs(task.dueDate), 'day');
            why = `⚠️ Overdue by ${daysLate} day${daysLate > 1 ? 's' : ''} → clears backlog`;
        } else if (task.dueDate && dayjs(task.dueDate).isSame(today, 'day')) {
            why = '📅 Due today → keeps you on track';
        } else if (task.scheduledDate && dayjs(task.scheduledDate).isBefore(today, 'day')) {
            const daysLate = today.diff(dayjs(task.scheduledDate), 'day');
            why = `⚠️ Scheduled ${daysLate} day${daysLate > 1 ? 's' : ''} ago → should have been done`;
        } else if (task.scheduledDate && dayjs(task.scheduledDate).isSame(today, 'day')) {
            why = '🎯 You scheduled this for today';
        } else if (task.priority?.toLowerCase().includes('high') || task.priority?.toLowerCase().includes('p1')) {
            why = '🚀 High priority → likely unlocks other work';
        } else if (task.status?.toLowerCase().includes('in progress')) {
            why = '🔄 Already in progress → finish what you started';
        }

        lines.push(`${i + 1}. ${emoji} *${task.title}*`);
        if (why) lines.push(`   _${why}_`);
        lines.push('');
    });

    lines.push('💪 *Completing these will reduce your mental load and build momentum.*');

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
