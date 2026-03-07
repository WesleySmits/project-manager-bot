/**
 * Project Manager Commands
 * /task <query|id>
 */
import { Context } from 'telegraf';
import { Temporal } from '@js-temporal/polyfill';
import { getProvider, Task } from '../providers';
import { createRequest, updateRequestStatus, getRequest } from '../pm/approvals';
import { logToDisk } from '../pm/middleware';
import { BotContext, ApprovalAction } from '../types';

/**
 * Format a single task detail view using the normalized Task type
 */
function formatTaskDetail(task: Task): string {
    const title = task.title;
    const status = task.status || 'No Status';
    const priority = task.priority || 'No Priority';
    const due = task.dueDate;
    const scheduled = task.scheduledDate;
    const desc = task.description || 'No description';
    const url = task.url;

    let text = `📄 *${title}*\n`;
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

    if (task.projectId) text += `🏗 Linked to Project\n`;

    text += `\n📝 *Description:*\n${desc.substring(0, 1000)}${desc.length > 1000 ? '...' : ''}\n`;
    text += `\n[Open ↗](${url})`;

    return text;
}

/**
 * Handle /task search <query>
 */
async function handleTaskSearch(ctx: BotContext, query: string): Promise<any> {
    await ctx.reply(`🔍 Searching for "${query}"...`);
    try {
        const provider = getProvider();
        const results = await provider.searchTasks(query, 5);

        if (results.length === 0) return ctx.reply('❌ No results found.');

        for (const task of results) {
            await ctx.reply(`📄 ${task.title}`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📂 Open', callback_data: `pm:open:${task.id}` }
                    ]]
                }
            });
        }
    } catch (err) {
        console.error(err);
        ctx.reply(`Error searching: ${err instanceof Error ? err.message : String(err)}`);
    }
}

/**
 * Handle /task <id> or detail view
 */
async function handleTaskDetail(ctx: BotContext, id: string | number): Promise<void> {
    try {
        await ctx.replyWithChatAction('typing');
        const provider = getProvider();

        let task: Task | null = null;
        if (typeof id === 'number') {
            task = await provider.getTaskByShortId(id);
        } else {
            // For full UUID IDs, search by ID — fall back to Notion-specific getPage if needed
            const tasks = await provider.fetchTasks();
            task = tasks.find(t => t.id === id) ?? null;

            // If not found in active tasks, try provider-specific lookup
            if (!task && process.env.PROVIDER === 'notion') {
                const { getPage } = await import('../notion/client');
                const { NotionProvider } = await import('../providers/notion/index');
                const page = await getPage(id);
                const np = new NotionProvider();
                const allTasks = await np.fetchTasks();
                task = allTasks.find(t => t.id === id) ?? null;
                if (!task) {
                    // Map the page directly
                    const { getTitle, getDescription, getStatus, getSelect, getDate } = await import('../notion/client');
                    task = {
                        id: page.id,
                        shortId: null,
                        title: getTitle(page),
                        description: getDescription(page),
                        status: getStatus(page) ?? 'unknown',
                        priority: getSelect(page, 'Priority'),
                        dueDate: getDate(page, 'Due Date') ?? getDate(page, 'Due'),
                        scheduledDate: getDate(page, 'Scheduled'),
                        projectId: null,
                        url: page.url,
                        completed: false,
                    };
                }
            }
        }

        if (!task) {
            await ctx.reply(`❌ Task not found for ID: ${id}`);
            return;
        }

        const text = formatTaskDetail(task);

        await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ Complete', callback_data: `pm:req:complete:${task.id}` },
                    { text: '📅 Remind', callback_data: `pm:req:remind:${task.id}` }
                ]]
            }
        });
    } catch (err) {
        console.error(err);
        ctx.reply(`Error fetching task: ${err instanceof Error ? err.message : String(err)}`);
    }
}

/**
 * Handle Command: /task
 */
export async function handleTaskCommand(ctx: BotContext): Promise<any> {
    const text = (ctx.message as any)?.text || '';
    const input = text.split(' ').slice(1).join(' ').trim();

    if (!input) return ctx.reply('Usage: /task <search query> OR /task <id>');

    if (input.startsWith('search ')) {
        return handleTaskSearch(ctx, input.replace('search ', '').trim());
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(input);
    const isNumericId = /^\d+$/.test(input);

    if (isUUID) return handleTaskDetail(ctx, input);
    if (isNumericId) return handleTaskDetail(ctx, parseInt(input, 10));
    return handleTaskSearch(ctx, input);
}

/**
 * Handle Callback: Open Task
 */
export async function handleCallbackOpen(ctx: BotContext): Promise<void> {
    const id = ctx.match?.[1];
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
    const [_, action, id] = match;
    const userId = ctx.from?.id;
    if (!userId) return;

    const reqId = await createRequest(action.toUpperCase() as ApprovalAction, { taskId: id }, userId);
    logToDisk(`REQUEST: User ${userId} requested ${action} on task ${id} (ReqID: ${reqId})`);

    await ctx.editMessageReplyMarkup({
        inline_keyboard: [[
            { text: '👍 Approve', callback_data: `pm:approve:${reqId}` },
            { text: '👎 Reject', callback_data: `pm:reject:${reqId}` }
        ]]
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
    const [_, decision, reqId] = match;
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
        const req = await getRequest(reqId);
        if (!req) return ctx.answerCbQuery('Request not found');
        if (req.status !== 'PENDING') return ctx.answerCbQuery('Request already resolved');

        const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
        await updateRequestStatus(reqId, status, userId);

        logToDisk(`RESOLVE: User ${userId} ${status} request ${reqId}`);

        const emoji = status === 'APPROVED' ? '✅' : '❌';
        await ctx.editMessageText(`📝 *Request Resolved*\nID: \`${reqId}\`\nStatus: ${emoji} ${status}`, { parse_mode: 'Markdown' });

        await ctx.answerCbQuery(`Request ${status}`);
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery('Error resolving request');
    }
}
