/**
 * Middleware for the Project Manager Bot
 * Handles logging and security whitelisting
 */
import * as fs from 'fs';
import * as path from 'path';
import { Context } from 'telegraf';
import { Temporal } from '@js-temporal/polyfill';

// Constants
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_CHAT_ID || '1962079073');
const LOG_FILE = path.join(__dirname, '../../logs/pm_commands.log');

/**
 * Append to log file
 */
export function logToDisk(message: string): void {
    const timestamp = Temporal.Now.plainDateTimeISO().toString().replace('T', ' ').split('.')[0];
    const line = `[${timestamp}] ${message}\n`;

    // Ensure directory exists
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFile(LOG_FILE, line, (err) => {
        if (err) console.error('Failed to write to log:', err);
    });
}

/**
 * Middleware: Verify user is whitelisted
 */
export const authMiddleware = async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const userId = ctx.from?.id;

    if (userId !== ALLOWED_USER_ID) {
        console.warn(`Unauthorized access attempt from User ID: ${userId}`);
        logToDisk(`UNAUTHORIZED: Access attempt from ${userId} (${ctx.from?.username})`);
        // Optional: Reply with polite refusal (commented out to be "stealthy" to strangers)
        // await ctx.reply('⛔ You are not authorized to use this bot.');
        return;
    }

    return next();
};

/**
 * Middleware: Log commands and approvals
 */
export const loggerMiddleware = async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || 'unknown';
    let action = '';

    // Telegraf types might need specific casting or checks for message content
    const message = ctx.message as any;

    if (message?.text) {
        action = `COMMAND: ${message.text}`;
    } else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        action = `CALLBACK: ${(ctx.callbackQuery as any).data}`;
    } else {
        action = `EVENT: ${ctx.updateType}`;
    }

    const logMessage = `User: ${userId} (${username}) | ${action}`;
    // console.log(logMessage); // Optional: log to stdout too
    logToDisk(logMessage);

    return next();
};
