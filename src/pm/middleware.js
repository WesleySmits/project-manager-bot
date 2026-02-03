/**
 * Middleware for the Project Manager Bot
 * Handles logging and security whitelisting
 */
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

// Constants
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_CHAT_ID || '1962079073');
const LOG_FILE = path.join(__dirname, '../../logs/pm_commands.log');

/**
 * Append to log file
 */
function logToDisk(message) {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFile(LOG_FILE, line, (err) => {
        if (err) console.error('Failed to write to log:', err);
    });
}

/**
 * Middleware: Verify user is whitelisted
 */
const authMiddleware = async (ctx, next) => {
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
const loggerMiddleware = async (ctx, next) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || 'unknown';
    let action = '';

    if (ctx.message?.text) {
        action = `COMMAND: ${ctx.message.text}`;
    } else if (ctx.callbackQuery?.data) {
        action = `CALLBACK: ${ctx.callbackQuery.data}`;
    } else {
        action = `EVENT: ${ctx.updateType}`;
    }

    const logMessage = `User: ${userId} (${username}) | ${action}`;
    // console.log(logMessage); // Optional: log to stdout too
    logToDisk(logMessage);

    return next();
};

module.exports = {
    authMiddleware,
    loggerMiddleware,
    logToDisk
};
