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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerMiddleware = exports.authMiddleware = void 0;
exports.logToDisk = logToDisk;
/**
 * Middleware for the Project Manager Bot
 * Handles logging and security whitelisting
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
// Constants
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_CHAT_ID || '1962079073');
const LOG_FILE = path.join(__dirname, '../../logs/pm_commands.log');
/**
 * Append to log file
 */
function logToDisk(message) {
    const timestamp = (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss');
    const line = `[${timestamp}] ${message}\n`;
    // Ensure directory exists
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFile(LOG_FILE, line, (err) => {
        if (err)
            console.error('Failed to write to log:', err);
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
exports.authMiddleware = authMiddleware;
/**
 * Middleware: Log commands and approvals
 */
const loggerMiddleware = async (ctx, next) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || 'unknown';
    let action = '';
    // Telegraf types might need specific casting or checks for message content
    const message = ctx.message;
    if (message?.text) {
        action = `COMMAND: ${message.text}`;
    }
    else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        action = `CALLBACK: ${ctx.callbackQuery.data}`;
    }
    else {
        action = `EVENT: ${ctx.updateType}`;
    }
    const logMessage = `User: ${userId} (${username}) | ${action}`;
    // console.log(logMessage); // Optional: log to stdout too
    logToDisk(logMessage);
    return next();
};
exports.loggerMiddleware = loggerMiddleware;
