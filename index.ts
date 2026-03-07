/**
 * Notion Bot - Main Entry Point
 * Telegram bot + Express API for web interface
 */
import '@js-temporal/polyfill';
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { getTodayTasks, formatTodayTasks } from './src/commands/todayTasks';
import { handleNotionHealth } from './src/commands/notionHealth';
import {
    handleTaskCommand, handleCallbackOpen,
    handleCallbackRequest, handleCallbackResolve
} from './src/commands/pm';
import { runStrategyAnalysis, formatStrategyReport } from './src/pm/strategy';
import { getStrategicAdvice } from './src/ai/gemini';
import { authMiddleware, loggerMiddleware } from './src/pm/middleware';
import { sendMorningBriefing, handleMorningBriefing } from './src/commands/morningBrief';
import apiRoutes from './src/routes/api';
import authRoutes from './src/routes/auth';
import healthDataRoutes from './src/routes/healthData';
import analyticsRoutes from './src/routes/analytics';
import autonomousRoutes from './src/routes/autonomous';
import { jwtAuthMiddleware } from './src/middleware/expressAuth';
import { apiKeyAuthMiddleware, requireAuth } from './src/middleware/apiKeyAuth';
import cookieParser from 'cookie-parser';
import { collectDailyMetrics } from './src/analytics/collector';
import { getLatestSnapshot } from './src/analytics/store';
import { Temporal } from '@js-temporal/polyfill';
import { BotContext } from './src/types';
import { rateLimit } from 'express-rate-limit';

// ─── Startup environment validation ──────────────────────────────────────────

const REQUIRED_ENV = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'NOTION_TOKEN',
    'NOTION_TASKS_DB',
    'NOTION_PROJECTS_DB',
    'NOTION_GOALS_DB',
    'JWT_SECRET',
    'API_KEY',
    'ALLOWED_ORIGIN',
    'RUNNER_TOKEN',
] as const;

const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;

console.log('🚀 Initializing Telegraf...');
const bot = new Telegraf<BotContext>(TELEGRAM_TOKEN);
console.log('✅ Telegraf initialized');

// Middleware (Security & Logging)
bot.use(authMiddleware);
bot.use(loggerMiddleware);

// /start command
bot.command('start', async (ctx: BotContext) => {
    await ctx.reply(
        '👋 *Welcome to Notion Task Bot!*\n\n' +
        '📅 *Daily*\n' +
        '• /today\\_tasks - Top 5 tasks for today\n' +
        '• /notion\\_health - Workspace health report\n\n' +
        '🚀 *Project Manager*\n' +
        '• /task `<query>` - Search tasks\n' +
        '• /task `<id>` - View detail & actions\n' +
        '• /strategy - Strategic "State of the Union" report\n' +
        '• /improve - 🧠 AI-powered strategic advice\n',
        { parse_mode: 'Markdown' }
    );
});

// /today_tasks command
bot.command('today_tasks', async (ctx: BotContext) => {
    try {
        await ctx.reply('📥 Fetching your tasks...');
        const tasks = await getTodayTasks(5);
        const formatted = formatTodayTasks(tasks);
        await ctx.reply(formatted, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error('today_tasks error:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        await ctx.reply(`❌ Error: ${errorMessage}`);
    }
});

// /notion_health command
bot.command('notion_health', handleNotionHealth);
bot.command('morning', handleMorningBriefing);

// PM Commands
bot.command('task', handleTaskCommand);
bot.command('strategy', async (ctx: BotContext) => {
    try {
        await ctx.reply('🧠 Analyzing strategy & roadmap...');
        const analysis = await runStrategyAnalysis();
        const report = formatStrategyReport(analysis);

        // Telegram message limit safety - chunk by lines, not mid-tag
        const lines = report.split('\n');
        const chunks: string[] = [];
        let current = '';
        for (const line of lines) {
            if ((current + '\n' + line).length > 4000) {
                chunks.push(current);
                current = line;
            } else {
                current = current ? current + '\n' + line : line;
            }
        }
        if (current) chunks.push(current);

        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: 'HTML' });
        }
    } catch (err) {
        console.error('Strategy error:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        await ctx.reply(`❌ Strategy check failed: ${errorMessage}`);
    }
});

// AI Improve Command
bot.command('improve', async (ctx: BotContext) => {
    try {
        await ctx.replyWithChatAction('typing');
        const analysis = await runStrategyAnalysis();

        // Check if we have issues to improve
        const hasStalled = analysis.issues.stalledGoals.length > 0;
        const hasZombies = analysis.issues.zombieProjects.length > 0;

        if (!hasStalled && !hasZombies && !analysis.issues.isOverloaded) {
             ctx.reply('🌟 You are optimizing perfectly! No critical issues found.');
             return;
        }

        await ctx.reply('🤔 Consulting the Oracle (Gemini)...');

        // Get advice
        const advice = await getStrategicAdvice(analysis);

        await ctx.reply(advice, { parse_mode: 'Markdown' });

    } catch (err) {
        console.error('Improve error:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        await ctx.reply(`❌ Improvement check failed: ${errorMessage}`);
    }
});

// Callbacks
bot.action(/^pm:open:(.+)$/, handleCallbackOpen);
bot.action(/^pm:req:(.+):(.+)$/, handleCallbackRequest);
bot.action(/^pm:(approve|reject):(.+)$/, handleCallbackResolve);

// Error handling
bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
});
console.log('✅ Telegram bot configured');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ─── Express Server ──────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

console.log('🚀 Initializing Express...');
const app = express();

// Trust reverse proxy (required when behind a load balancer/reverse proxy)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: 'draft-7', // combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiter to all API routes
app.use('/api', limiter);

app.use(cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
console.log('✅ Express initialized');

// Auth Routes (Public — no JWT or API key required)
app.use('/api/auth', authRoutes);

// API key + JWT: either scheme authenticates the request
app.use(apiKeyAuthMiddleware);

// API routes that SHOULD NOT be protected by JWT middleware
app.use('/api/autonomous', autonomousRoutes);

app.use(jwtAuthMiddleware);

// API routes (protected by the middleware stack above)
app.use('/api', apiRoutes);
app.use('/api/health-data', healthDataRoutes);
app.use('/api/analytics', analyticsRoutes);

// Morning briefing endpoint — requires API key or JWT
app.post('/morning-brief', requireAuth, async (_req, res) => {
    try {
        await sendMorningBriefing(bot);
        res.json({ status: 'ok', message: 'Morning briefing sent', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('Morning brief endpoint error:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        res.status(500).json({ status: 'error', message: errorMessage });
    }
});

// Serve static frontend (production)
const webDistPath = path.join(__dirname, 'web');
app.use(express.static(webDistPath));

// SPA fallback - serve index.html for app routes only.
// Important: if a request looks like a static asset (has a file extension),
// return 404 so browsers don't get HTML for missing JS/CSS files.
app.get('{*path}', (req, res) => {
    const reqPath = req.path || '';
    if (reqPath.includes('.')) {
        res.status(404).end();
        return;
    }

    const indexPath = path.join(webDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            // During development when web isn't built yet
            res.status(200).json({ status: 'ok', message: 'API is running. Web UI not built yet.' });
        }
    });
});

// ─── Start ───────────────────────────────────────────────────────────────────

// Start Express server first (always available)
const PORT = process.env.PORT || 3301;
app.listen(PORT, () => {
    console.log(`✅ Express server running on port ${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api/health`);
    console.log(`   Web: http://localhost:${PORT}/`);
});

// Start Telegram bot (non-blocking — Express stays up if this fails)
console.log('🚀 Updating Telegram commands...');
bot.telegram.setMyCommands([
    { command: 'morning', description: '☀️ Morning briefing' },
    { command: 'today_tasks', description: '📅 Top 5 tasks for today' },
    { command: 'strategy', description: '🧠 Strategic "State of the Union"' },
    { command: 'improve', description: '✨ AI Advice on what to fix next' },
    { command: 'task', description: '🔎 Search or view tasks' },
    { command: 'notion_health', description: '🏥 Workspace health check' }
]).then(() => {
    console.log('✅ Telegram command menu updated');
}).catch(err => {
    console.warn('⚠️ Failed to update Telegram commands:', err.message);
});

console.log('🚀 Launching Telegram bot...');
bot.launch().then(() => {
    console.log('🤖 Notion Bot started (polling mode)');
}).catch(err => {
    console.error('⚠️ Telegram bot failed to start:', err.message);
    console.log('   Express API is still running — web interface available.');
});

// ─── Scheduler ───────────────────────────────────────────────────────────────

// Check every hour if we need to run daily analytics
setInterval(async () => {
    try {
        const now = Temporal.Now.plainDateISO();
        const latest = await getLatestSnapshot();

        // If no snapshot for today, run valid daily collection
        // We run it if the last snapshot is NOT from today
        // This ensures one run per day (first time we check after midnight)
        if (!latest || latest.date !== now.toString()) {
            console.log('📊 Running daily analytics collection...');
            await collectDailyMetrics();
            console.log('✅ Daily analytics collected');
        }
    } catch (err) {
        console.error('❌ Daily analytics scheduler failed:', err);
    }
}, 60 * 60 * 1000); // Check every hour
