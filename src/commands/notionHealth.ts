/**
 * Notion Health Command Handler
 */
import { Context } from 'telegraf';
import { runHealthCheck, formatHealthReport } from '../notion/health';

export async function handleNotionHealth(ctx: Context): Promise<void> {
    try {
        await ctx.reply('🔍 Checking Notion workspace...');
        const report = await runHealthCheck();
        const formatted = formatHealthReport(report);

        // Split into chunks by lines (not mid-tag)
        const lines = formatted.split('\n');
        const chunks: string[] = [];
        let current = '';
        for (const line of lines) {
            if ((current + '\n' + line).length > 3500) {
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
        console.error('notion_health error:', err);
        // Cast err to any or Error to access message
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        await ctx.reply(`❌ Health check failed: ${errorMessage}`);
    }
}
