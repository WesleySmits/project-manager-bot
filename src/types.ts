import { Context } from 'telegraf';

/**
 * Custom Telegraf Context to include properties populated by middleware
 * and regex matchers.
 */
export interface BotContext extends Context {
    /** Populated by Telegraf when using regex matchers in bot.action or bot.hears */
    match?: RegExpExecArray;
}

/**
 * Valid approval actions
 */
export type ApprovalAction = 'COMPLETE' | 'REMIND' | 'RESOLVE' | 'REJECT' | 'APPROVE';

/**
 * Payload for approval requests
 */
export interface TaskRequestPayload {
    taskId: string;
    [key: string]: unknown;
}

/**
 * Union of all possible request payloads
 */
export type RequestPayload = TaskRequestPayload;
