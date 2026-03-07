/**
 * Provider Factory & Singleton
 *
 * Usage anywhere in the codebase:
 *   import { getProvider } from '../providers';
 *   const provider = getProvider();
 *   const tasks = await provider.fetchTasks();
 *
 * Configure via .env:
 *   PROVIDER=notion    (default)
 *   PROVIDER=todoist
 *   PROVIDER=mcp
 */
import type { TodoProvider } from './types';

export type { TodoProvider, Task, Project, Goal, CreateTaskParams, HealthCheckResult, HealthIssue } from './types';

let _instance: TodoProvider | null = null;

/**
 * Returns the singleton TodoProvider for the current PROVIDER env.
 * Lazily instantiated on first call.
 */
export function getProvider(): TodoProvider {
    if (_instance) return _instance;

    const providerName = (process.env.PROVIDER ?? 'notion').toLowerCase();

    switch (providerName) {
        case 'notion':
            // Dynamic require to avoid importing Notion client when not needed
            const { NotionProvider } = require('./notion/index');
            _instance = new NotionProvider();
            break;

        case 'todoist': {
            const { TodoistProvider } = require('./todoist/index');
            _instance = new TodoistProvider();
            break;
        }

        case 'mcp': {
            const { McpProvider } = require('./mcp/index');
            _instance = new McpProvider();
            break;
        }

        default:
            throw new Error(
                `Unknown PROVIDER="${providerName}". Valid options: notion, todoist, mcp.\n` +
                `To add a new provider, implement TodoProvider in src/providers/<name>/index.ts ` +
                `and register it here.`
            );
    }

    console.log(`✅ TodoProvider: ${_instance!.name}`);
    return _instance!;
}

/**
 * Override the provider instance (useful for tests).
 */
export function setProvider(provider: TodoProvider): void {
    _instance = provider;
}

/**
 * Reset the provider singleton (useful for tests or hot-reload).
 */
export function resetProvider(): void {
    _instance = null;
}
