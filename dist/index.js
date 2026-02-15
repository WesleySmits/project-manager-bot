"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Notion Bot - Main Entry Point
 * Telegram bot for Notion task management
 */
require("dotenv/config");
const telegraf_1 = require("telegraf");
const http = __importStar(require("http"));
const todayTasks_1 = require("./src/commands/todayTasks");
const notionHealth_1 = require("./src/commands/notionHealth");
const pm_1 = require("./src/commands/pm");
const strategy_1 = require("./src/pm/strategy");
const gemini_1 = require("./src/ai/gemini");
const middleware_1 = require("./src/pm/middleware");
const morningBrief_1 = require("./src/commands/morningBrief");
// Validate environment
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
    process.exit(1);
}
if (!NOTION_TOKEN) {
    console.error('❌ NOTION_TOKEN not set in .env');
    process.exit(1);
}
const bot = new telegraf_1.Telegraf(TELEGRAM_TOKEN);
// Middleware (Security & Logging)
bot.use(middleware_1.authMiddleware);
bot.use(middleware_1.loggerMiddleware);
// /start command
bot.command('start', async (ctx) => {
    await ctx.reply('👋 *Welcome to Notion Task Bot!*\n\n' +
        '📅 *Daily*\n' +
        '• /today\\_tasks - Top 5 tasks for today\n' +
        '• /notion\\_health - Workspace health report\n\n' +
        '🚀 *Project Manager*\n' +
        '• /task `<query>` - Search tasks\n' +
        '• /task `<id>` - View detail & actions\n' +
        '• /strategy - Strategic "State of the Union" report\n' +
        '• /improve - 🧠 AI-powered strategic advice\n', { parse_mode: 'Markdown' });
});
// /today_tasks command
bot.command('today_tasks', async (ctx) => {
    try {
        await ctx.reply('📥 Fetching your tasks...');
        const tasks = await (0, todayTasks_1.getTodayTasks)(5);
        const formatted = (0, todayTasks_1.formatTodayTasks)(tasks);
        await ctx.reply(formatted, { parse_mode: 'Markdown' });
    }
    catch (err) {
        console.error('today_tasks error:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        await ctx.reply(`❌ Error: ${errorMessage}`);
    }
});
// /notion_health command
bot.command('notion_health', notionHealth_1.handleNotionHealth);
// PM Commands
bot.command('task', pm_1.handleTaskCommand);
bot.command('strategy', async (ctx) => {
    try {
        await ctx.reply('🧠 Analyzing strategy & roadmap...');
        const analysis = await (0, strategy_1.runStrategyAnalysis)();
        const report = (0, strategy_1.formatStrategyReport)(analysis);
        // Telegram message limit safety - chunk by lines, not mid-tag
        const lines = report.split('\n');
        const chunks = [];
        let current = '';
        for (const line of lines) {
            if ((current + '\n' + line).length > 4000) {
                chunks.push(current);
                current = line;
            }
            else {
                current = current ? current + '\n' + line : line;
            }
        }
        if (current)
            chunks.push(current);
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: 'HTML' });
        }
    }
    catch (err) {
        console.error('Strategy error:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        await ctx.reply(`❌ Strategy check failed: ${errorMessage}`);
    }
});
// AI Improve Command
bot.command('improve', async (ctx) => {
    try {
        await ctx.replyWithChatAction('typing');
        const analysis = await (0, strategy_1.runStrategyAnalysis)();
        // Check if we have issues to improve
        const hasStalled = analysis.issues.stalledGoals.length > 0;
        const hasZombies = analysis.issues.zombieProjects.length > 0;
        if (!hasStalled && !hasZombies && !analysis.issues.isOverloaded) {
            ctx.reply('🌟 You are optimizing perfectly! No critical issues found.');
            return;
        }
        await ctx.reply('🤔 Consulting the Oracle (Gemini)...');
        // Get advice
        const advice = await (0, gemini_1.getStrategicAdvice)(analysis);
        await ctx.reply(advice, { parse_mode: 'Markdown' });
    }
    catch (err) {
        console.error('Improve error:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        await ctx.reply(`❌ Improvement check failed: ${errorMessage}`);
    }
});
// Callbacks
bot.action(/^pm:open:(.+)$/, pm_1.handleCallbackOpen);
bot.action(/^pm:req:(.+):(.+)$/, pm_1.handleCallbackRequest);
bot.action(/^pm:(approve|reject):(.+)$/, pm_1.handleCallbackResolve);
// Error handling
bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
});
// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
// Register commands and start bot
(async () => {
    try {
        // Set Telegram Command Menu
        bot.telegram.setMyCommands([
            { command: 'today_tasks', description: '📅 Top 5 tasks for today' },
            { command: 'strategy', description: '🧠 Strategic "State of the Union"' },
            { command: 'improve', description: '✨ AI Advice on what to fix next' },
            { command: 'task', description: '🔎 Search or view tasks' },
            { command: 'notion_health', description: '🏥 Workspace health check' }
        ]).then(() => {
            console.log('✅ Telegram command menu updated');
        }).catch(console.error);
        // Health Check Server with Morning Briefing endpoint
        const HEALTH_PORT = process.env.PORT || 3301;
        const server = http.createServer(async (req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    service: 'project-manager',
                    timestamp: new Date().toISOString()
                }));
            }
            else if (req.url === '/morning-brief') {
                try {
                    await (0, morningBrief_1.sendMorningBriefing)(bot);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'ok',
                        message: 'Morning briefing sent',
                        timestamp: new Date().toISOString()
                    }));
                }
                catch (err) {
                    console.error('Morning brief endpoint error:', err);
                    const errorMessage = (err instanceof Error) ? err.message : String(err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'error',
                        message: errorMessage
                    }));
                }
            }
            else {
                res.writeHead(404);
                res.end();
            }
        });
        server.listen(HEALTH_PORT, () => {
            console.log(`✅ Health check + morning brief endpoint running on port ${HEALTH_PORT}`);
        });
        // Start bot
        bot.launch();
        console.log('🤖 Notion Bot started (polling mode)');
    }
    catch (err) {
        console.error('Failed to start bot:', err);
        process.exit(1);
    }
})();
