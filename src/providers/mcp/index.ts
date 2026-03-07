/**
 * McpProvider — MCP (Model Context Protocol) based todo provider.
 *
 * This provider connects to any MCP server that exposes todo/task tools.
 * It works with any app that has an MCP integration (Things 3, OmniFocus,
 * Apple Reminders via MCP servers, etc.).
 *
 * To activate: set PROVIDER=mcp and MCP_SERVER_URL=<url> in .env.
 * The MCP server must implement the following tools:
 *   - list_tasks      -> returns Task[]
 *   - list_projects   -> returns Project[]
 *   - list_goals      -> returns Goal[] (optional)
 *   - update_task     -> updates a task's properties
 *   - create_task     -> creates a new task
 *
 * See: https://modelcontextprotocol.io/
 */
import type {
    TodoProvider,
    Task,
    Project,
    Goal,
    CreateTaskParams,
    HealthCheckResult,
} from '../types';

interface McpToolCall {
    tool: string;
    params?: Record<string, unknown>;
}

interface McpToolResult {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

export class McpProvider implements TodoProvider {
    readonly name = 'MCP';

    private readonly serverUrl: string;

    constructor() {
        const url = process.env.MCP_SERVER_URL;
        if (!url) throw new Error('MCP_SERVER_URL is required for the MCP provider.');
        this.serverUrl = url;
    }

    /** Call an MCP tool via HTTP/SSE transport */
    private async callTool(call: McpToolCall): Promise<unknown> {
        const res = await fetch(`${this.serverUrl}/tools/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: { name: call.tool, arguments: call.params ?? {} },
                id: Date.now(),
            }),
        });
        if (!res.ok) throw new Error(`MCP tool call failed: ${res.status}`);
        const json = await res.json() as { result?: McpToolResult; error?: { message: string } };
        if (json.error) throw new Error(`MCP error: ${json.error.message}`);
        const result = json.result as McpToolResult;
        if (result.isError) throw new Error(`MCP tool error: ${result.content[0]?.text}`);
        // Parse JSON from text content
        const text = result.content[0]?.text ?? '[]';
        return JSON.parse(text);
    }

    async fetchTasks(): Promise<Task[]> {
        return (await this.callTool({ tool: 'list_tasks' })) as Task[];
    }

    async fetchProjects(): Promise<Project[]> {
        return (await this.callTool({ tool: 'list_projects' })) as Project[];
    }

    async fetchGoals(): Promise<Goal[]> {
        try {
            return (await this.callTool({ tool: 'list_goals' })) as Goal[];
        } catch {
            return []; // Goals are optional in MCP providers
        }
    }

    async getTaskByShortId(shortId: number): Promise<Task | null> {
        try {
            return (await this.callTool({ tool: 'get_task', params: { short_id: shortId } })) as Task;
        } catch {
            // Fall back to filtering fetchTasks
            const tasks = await this.fetchTasks();
            return tasks.find(t => t.shortId === shortId) ?? null;
        }
    }

    async searchTasks(query: string, limit = 7): Promise<Task[]> {
        try {
            return (await this.callTool({ tool: 'search_tasks', params: { query, limit } })) as Task[];
        } catch {
            const tasks = await this.fetchTasks();
            return tasks
                .filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
                .slice(0, limit);
        }
    }

    async updateTaskStatus(taskId: string, status: string): Promise<Task> {
        return (await this.callTool({
            tool: 'update_task',
            params: { id: taskId, status },
        })) as Task;
    }

    async rescheduleTask(taskId: string, date: string | null): Promise<Task> {
        return (await this.callTool({
            tool: 'update_task',
            params: { id: taskId, scheduled_date: date },
        })) as Task;
    }

    async createTask(params: CreateTaskParams): Promise<Task> {
        return (await this.callTool({ tool: 'create_task', params: params as unknown as Record<string, unknown> })) as Task;
    }

    async healthCheck(): Promise<HealthCheckResult> {
        try {
            const tasks = await this.fetchTasks();
            return {
                ok: true,
                issues: [],
                stats: { taskCount: tasks.length, projectCount: 0, goalCount: 0 },
            };
        } catch (err) {
            return {
                ok: false,
                issues: [{
                    severity: 'error',
                    message: `MCP server unreachable: ${err instanceof Error ? err.message : String(err)}`,
                }],
                stats: { taskCount: 0, projectCount: 0, goalCount: 0 },
            };
        }
    }
}
