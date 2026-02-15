"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTaskCommand = handleTaskCommand;
exports.handleCallbackOpen = handleCallbackOpen;
exports.handleCallbackRequest = handleCallbackRequest;
exports.handleCallbackResolve = handleCallbackResolve;
const dayjs_1 = __importDefault(require("dayjs"));
const client_1 = require("../notion/client");
const approvals_1 = require("../pm/approvals");
const middleware_1 = require("../pm/middleware");
/**
 * Format a single task detail view
 */
function formatTaskDetail(page) {
    const icon = page.icon?.emoji || '📄';
    const title = (0, client_1.getTitle)(page);
    const status = page.properties?.Status?.status?.name || 'No Status';
    const priority = page.properties?.Priority?.select?.name || 'No Priority';
    const due = (0, client_1.getDate)(page, 'Due Date') || (0, client_1.getDate)(page, 'Due');
    const scheduled = (0, client_1.getDate)(page, 'Scheduled');
    const desc = (0, client_1.getDescription)(page) || 'No description';
    const url = page.url;
    let text = `${icon} *${title}*\n`;
    text += `────────────────\n`;
    text += `🏷 Status: ${status} | Priority: ${priority}\n`;
    if (due) {
        const isOverdue = (0, dayjs_1.default)(due).isBefore((0, dayjs_1.default)(), 'day');
        text += `📅 Due: ${(0, dayjs_1.default)(due).format('D MMM YYYY')}${isOverdue ? ' ⚠️ OVERDUE' : ''}\n`;
    }
    if (scheduled) {
        const isOverdue = (0, dayjs_1.default)(scheduled).isBefore((0, dayjs_1.default)(), 'day');
        text += `🗓 Scheduled: ${(0, dayjs_1.default)(scheduled).format('D MMM YYYY')}${isOverdue ? ' ⚠️ OVERDUE' : ''}\n`;
    }
    // Relations (Projects/Goals)
    // Note: We only have IDs here usually, actual names require extra fetches
    // For Phase 1 we just indicate presence
    if ((0, client_1.hasRelation)(page, 'Project'))
        text += `🏗 Linked to Project\n`;
    text += `\n📝 *Description:*\n${desc.substring(0, 1000)}${desc.length > 1000 ? '...' : ''}\n`;
    text += `\n[Open in Notion](${url})`;
    return text;
}
/**
 * Handle /task search <query>
 */
async function handleTaskSearch(ctx, query) {
    await ctx.reply(`🔍 Searching for "${query}"...`);
    try {
        const results = await (0, client_1.search)(query);
        if (results.length === 0) {
            return ctx.reply('❌ No results found.');
        }
        // Send each result with an "Open" button
        for (const page of results.slice(0, 5)) {
            const title = (0, client_1.getTitle)(page);
            const icon = page.icon?.emoji || '📄';
            await ctx.reply(`${icon} ${title}`, {
                reply_markup: {
                    inline_keyboard: [[
                            { text: '📂 Open', callback_data: `pm:open:${page.id}` }
                        ]]
                }
            });
        }
    }
    catch (err) {
        console.error(err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        ctx.reply(`Error searching: ${errorMessage}`);
    }
}
/**
 * Handle /task <id> or detail view
 */
async function handleTaskDetail(ctx, id) {
    try {
        await ctx.replyWithChatAction('typing');
        const page = await (0, client_1.getPage)(id);
        const text = formatTaskDetail(page);
        // Add actions (Phase 2 approval actions)
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Complete', callback_data: `pm:req:complete:${id}` },
                        { text: '📅 Remind', callback_data: `pm:req:remind:${id}` }
                    ]
                ]
            }
        });
    }
    catch (err) {
        console.error(err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        ctx.reply(`Error fetching task: ${errorMessage}`);
    }
}
/**
 * Handle Command: /task
 */
async function handleTaskCommand(ctx) {
    const text = ctx.message?.text || '';
    const input = text.split(' ').slice(1).join(' ');
    if (!input) {
        return ctx.reply('Usage: /task <search query> OR /task <id>');
    }
    if (input.startsWith('search ')) {
        return handleTaskSearch(ctx, input.replace('search ', ''));
    }
    // If input looks like UUID, treat as ID, otherwise search
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(input);
    if (isUUID) {
        return handleTaskDetail(ctx, input);
    }
    else {
        return handleTaskSearch(ctx, input);
    }
}
/**
 * Handle Callback: Open Task
 */
async function handleCallbackOpen(ctx) {
    // @ts-ignore - ctx.match is populated by Telegraf regex matcher
    const id = ctx.match[1]; // Captured from regex `pm:open:(.+)`
    await ctx.answerCbQuery();
    await handleTaskDetail(ctx, id);
}
/**
 * Handle Callback: Request Action (Approval Flow)
 */
async function handleCallbackRequest(ctx) {
    // @ts-ignore - ctx.match is populated by Telegraf regex matcher
    const [_, action, id] = ctx.match; // `pm:req:(.+):(.+)`
    const userId = ctx.from?.id;
    if (!userId)
        return;
    // Create pending request
    const reqId = await (0, approvals_1.createRequest)(action.toUpperCase(), { taskId: id }, userId);
    (0, middleware_1.logToDisk)(`REQUEST: User ${userId} requested ${action} on task ${id} (ReqID: ${reqId})`);
    // Edit message to show approval UI
    await ctx.editMessageReplyMarkup({
        inline_keyboard: [
            [
                { text: '👍 Approve', callback_data: `pm:approve:${reqId}` },
                { text: '👎 Reject', callback_data: `pm:reject:${reqId}` }
            ]
        ]
    });
    await ctx.reply(`📝 *Request Created*\nAction: ${action.toUpperCase()}\nID: \`${reqId}\`\n\n(Waiting for approval...)`, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('Request created');
}
/**
 * Handle Callback: Resolve Request (Approve/Reject)
 */
async function handleCallbackResolve(ctx) {
    // @ts-ignore - ctx.match is populated by Telegraf regex matcher
    const [_, decision, reqId] = ctx.match; // `pm:(approve|reject):(.+)`
    const userId = ctx.from?.id;
    if (!userId)
        return;
    try {
        const req = await (0, approvals_1.getRequest)(reqId);
        if (!req)
            return ctx.answerCbQuery('Request not found');
        if (req.status !== 'PENDING')
            return ctx.answerCbQuery('Request already resolved');
        const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
        await (0, approvals_1.updateRequestStatus)(reqId, status, userId);
        (0, middleware_1.logToDisk)(`RESOLVE: User ${userId} ${status} request ${reqId}`);
        // Update UI
        const emoji = status === 'APPROVED' ? '✅' : '❌';
        await ctx.editMessageText(`📝 *Request Resolved*\nID: \`${reqId}\`\nStatus: ${emoji} ${status}\n\n(No changes made to Notion in Read-Only mode)`, { parse_mode: 'Markdown' });
        await ctx.answerCbQuery(`Request ${status}`);
    }
    catch (err) {
        console.error(err);
        ctx.answerCbQuery('Error resolving request');
    }
}
