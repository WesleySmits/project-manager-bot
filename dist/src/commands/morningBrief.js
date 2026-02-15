"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMorningBriefing = generateMorningBriefing;
exports.sendMorningBriefing = sendMorningBriefing;
/**
 * Morning Briefing Module
 * Generates and sends daily morning briefing with prioritized tasks + "why" explanations
 */
const dayjs_1 = __importDefault(require("dayjs"));
const todayTasks_1 = require("./todayTasks");
const health_1 = require("../notion/health");
const client_1 = require("../notion/client");
const gemini_1 = require("../ai/gemini");
/**
 * Generate morning briefing message with "why" explanations
 * @returns {Promise<string>}
 */
async function generateMorningBriefing() {
    // parallel fetch for performance
    const [tasks, health, goals] = await Promise.all([
        (0, todayTasks_1.getTodayTasks)(3),
        (0, health_1.runHealthCheck)(),
        (0, client_1.fetchGoals)()
    ]);
    const lines = [];
    const today = (0, dayjs_1.default)();
    // 1. HEADER
    lines.push('☀️ *Good morning!*');
    lines.push('');
    // 2. ISSUES (if any)
    const { issues } = health;
    const criticalIssues = [];
    if (issues.orphanedTasks.length > 0)
        criticalIssues.push(`${issues.orphanedTasks.length} orphaned tasks`);
    if (issues.projectsWithoutGoal.length > 0)
        criticalIssues.push(`${issues.projectsWithoutGoal.length} projects w/o goal`);
    if (issues.overdueDueDate.length > 0)
        criticalIssues.push(`${issues.overdueDueDate.length} overdue tasks`);
    if (criticalIssues.length > 0) {
        lines.push('🚨 *Attention Needed:*');
        lines.push(`You have ${criticalIssues.join(', ')} to fix in Notion.`);
        lines.push('');
    }
    // 3. PRIORITIES
    if (tasks.length === 0) {
        lines.push('✨ No urgent tasks today. Great time for deep work or strategic planning.');
    }
    else {
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
        const insights = await (0, gemini_1.getTaskInsights)(tasks, goals);
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
        console.log(`✅ Morning briefing sent at ${(0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss')}`);
    }
    catch (err) {
        console.error('❌ Morning briefing error:', err);
        throw err;
    }
}
