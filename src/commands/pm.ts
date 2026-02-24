/**
 * Project Manager Commands
 * /task <query|id>
 * /task search <query>
 * /tasks due <today|tomorrow|overdue>
 */
import { Context } from 'telegraf';
import { Temporal } from '@js-temporal/polyfill';
import {
    search, getPage, getTitle, getDescription, getDate, hasRelation,
    NotionPage, getTaskByShortId
} from '../notion/client';
import { createRequest, updateRequestStatus, getRequest } from '../pm/approvals';
import { logToDisk } from '../pm/middleware';
import { BotContext, ApprovalAction } from '../types';

/**
 * Format a single task detail view
 */
function formatTaskDetail(page: NotionPage): string {
    const icon = page.icon?.type === 'emoji' ? page.icon.emoji : '📄';
    const title = getTitle(page);
    const statusProp = page.properties?.['Status'];
    const status = (statusProp && statusProp.type === 'status' && statusProp.status?.name) || 'No Status';
    const priorityProp = page.properties?.['Priority'];
    const priority = (priorityProp && priorityProp.type === 'select' && priorityProp.select?.name) || 'No Priority';
    const due = getDate(page, 'Due Date') || getDate(page, 'Due');
    const scheduled = getDate(page, 'Scheduled');
    const desc = getDescription(page) || 'No description';
    const url = page.url;

    let text = `${icon} *${title}*\n`;
    text += `────────────────\n`;
    text += `🏷 Status: ${status} | Priority: ${priority}\n`;

    const today = Temporal.Now.plainDateISO();

    if (due) {
        const isOverdue = Temporal.PlainDate.compare(Temporal.PlainDate.from(due), today) < 0;
        const dateStr = Temporal.PlainDate.from(due).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        text += `📅 Due: ${dateStr}${isOverdue ? ' ⚠️ OVERDUE' : ''}\n`;
    }
    if (scheduled) {
        const isOverdue = Temporal.PlainDate.compare(Temporal.PlainDate.from(scheduled), today) < 0;
        const dateStr = Temporal.PlainDate.from(scheduled).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        text += `🗓 Scheduled: ${dateStr}${isOverdue ? ' ⚠️ OVERDUE' : ''}\n`;
    }

    // Relations (Projects/Goals)
    // Note: We only have IDs here usually, actual names require extra fetches
    // For Phase 1 we just indicate presence
    if (hasRelation(page, 'Project')) text += `🏗 Linked to Project\n`;

    text += `\n📝 *Description:*\n${desc.substring(0, 1000)}${desc.length > 1000 ? '...' : ''}\n`;
    text += `\n[Open in Notion](${url})`;

    return text;
}

/**
 * Handle /task search <query>
 */
async function handleTaskSearch(ctx: BotContext, query: string): Promise<any> {
    await ctx.reply(`🔍 Searching for "${query}"...`);
    try {
        const results = await search(query);

        if (results.length === 0) {
            return ctx.reply('❌ No results found.');
        }

        // Send each result with an "Open" button
        for (const page of results.slice(0, 5)) {
            const title = getTitle(page);
            const icon = page.icon?.type === 'emoji' ? page.icon.emoji : '📄';

            await ctx.reply(`${icon} ${title}`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📂 Open', callback_data: `pm:open:${page.id}` }
                    ]]
                }
            });
        }
    } catch (err) {
        console.error(err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        ctx.reply(`Error searching: ${errorMessage}`);
    }
}

/**
 * Handle /task <id> or detail view
 */
async function handleTaskDetail(ctx: BotContext, id: string | number): Promise<void> {
    try {
        await ctx.replyWithChatAction('typing');
        const page = typeof id === 'number' ? await getTaskByShortId(id) : await getPage(id);

        if (!page) {
            await ctx.reply(`❌ Task not found for ID: ${id}`);
            return;
        }

        const text = formatTaskDetail(page);

        // Add actions (Phase 2 approval actions)
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Complete', callback_data: `pm:req:complete:${page.id}` },
                        { text: '📅 Remind', callback_data: `pm:req:remind:${page.id}` }
                    ]
                ]
            }
        });
    } catch (err) {
        console.error(err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        ctx.reply(`Error fetching task: ${errorMessage}`);
    }
}

/**
 * Handle Command: /task
 */
export async function handleTaskCommand(ctx: BotContext): Promise<any> {
    const text = (ctx.message as any)?.text || '';
    const input = text.split(' ').slice(1).join(' ').trim();

    if (!input) {
        return ctx.reply('Usage: /task <search query> OR /task <id>');
    }

    if (input.startsWith('search ')) {
        return handleTaskSearch(ctx, input.replace('search ', '').trim());
    }

    // If input looks like UUID, treat as ID, otherwise search
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(input);
    const isNumericId = /^\d+$/.test(input);

    if (isUUID) {
        return handleTaskDetail(ctx, input);
    } else if (isNumericId) {
        return handleTaskDetail(ctx, parseInt(input, 10));
    } else {
        return handleTaskSearch(ctx, input);
    }
}

/**
 * Handle Callback: Open Task
 */
export async function handleCallbackOpen(ctx: BotContext): Promise<void> {
    const id = ctx.match?.[1]; // Captured from regex `pm:open:(.+)`
    if (!id) return;
    await ctx.answerCbQuery();
    await handleTaskDetail(ctx, id);
}

/**
 * Handle Callback: Request Action (Approval Flow)
 */
export async function handleCallbackRequest(ctx: BotContext): Promise<void> {
    const match = ctx.match;
    if (!match) return;
    const [_, action, id] = match; // `pm:req:(.+):(.+)`
    const userId = ctx.from?.id;
    if (!userId) return;

    // Create pending request
    const reqId = await createRequest(action.toUpperCase() as ApprovalAction, { taskId: id }, userId);

    logToDisk(`REQUEST: User ${userId} requested ${action} on task ${id} (ReqID: ${reqId})`);

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
export async function handleCallbackResolve(ctx: BotContext): Promise<any> {
    const match = ctx.match;
    if (!match) return;
    const [_, decision, reqId] = match; // `pm:(approve|reject):(.+)`
    const userId = ctx.from?.id;

    if (!userId) return;

    try {
        const req = await getRequest(reqId);
        if (!req) return ctx.answerCbQuery('Request not found');
        if (req.status !== 'PENDING') return ctx.answerCbQuery('Request already resolved');

        const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
        await updateRequestStatus(reqId, status, userId);

        logToDisk(`RESOLVE: User ${userId} ${status} request ${reqId}`);

        // Update UI
        const emoji = status === 'APPROVED' ? '✅' : '❌';
        await ctx.editMessageText(`📝 *Request Resolved*\nID: \`${reqId}\`\nStatus: ${emoji} ${status}\n\n(No changes made to Notion in Read-Only mode)`, { parse_mode: 'Markdown' });

        await ctx.answerCbQuery(`Request ${status}`);
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery('Error resolving request');
    }
}
