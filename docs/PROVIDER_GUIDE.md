# Adding a New Todo Provider

The PM Bot uses a provider abstraction layer (`src/providers/`) so it can work with
any task management app — not just Notion.

## How it works

```
src/providers/
  types.ts          ← normalized Task, Project, Goal + TodoProvider interface
  index.ts          ← factory / active provider singleton
  notion/index.ts   ← NotionProvider (production)
  todoist/index.ts  ← TodoistProvider (example implementation)
  mcp/index.ts      ← McpProvider (for any MCP-compatible todo app)
```

Application code calls `getProvider()` and never imports Notion directly:

```ts
import { getProvider } from '../providers';

const provider = getProvider();
const tasks = await provider.fetchTasks();
```

## Switching providers

Set `PROVIDER` in your `.env`:

```env
# Options: notion (default), todoist, mcp
PROVIDER=todoist
TODOIST_API_TOKEN=your_token_here
```

## Adding a new provider

### 1. Create the directory

```
src/providers/<name>/index.ts
```

### 2. Implement the `TodoProvider` interface

```ts
import type { TodoProvider, Task, Project, Goal, CreateTaskParams, HealthCheckResult } from '../types';

export class MyAppProvider implements TodoProvider {
    readonly name = 'MyApp';

    async fetchTasks(): Promise<Task[]> { /* ... */ }
    async fetchProjects(): Promise<Project[]> { /* ... */ }
    async fetchGoals(): Promise<Goal[]> { /* ... */ }
    async getTaskByShortId(shortId: number): Promise<Task | null> { /* ... */ }
    async searchTasks(query: string, limit?: number): Promise<Task[]> { /* ... */ }
    async updateTaskStatus(taskId: string, status: string): Promise<Task> { /* ... */ }
    async rescheduleTask(taskId: string, date: string | null): Promise<Task> { /* ... */ }
    async createTask(params: CreateTaskParams): Promise<Task> { /* ... */ }
    async healthCheck(): Promise<HealthCheckResult> { /* ... */ }
}
```

### 3. Register it in `src/providers/index.ts`

```ts
case 'myapp': {
    const { MyAppProvider } = require('./myapp/index');
    _instance = new MyAppProvider();
    break;
}
```

### 4. Document required env vars in `.env.example`

```env
# MyApp provider
PROVIDER=myapp
MYAPP_API_TOKEN=
```

## MCP-based providers

If your todo app has an MCP server, you don't need to write any code.
Just set:

```env
PROVIDER=mcp
MCP_SERVER_URL=http://localhost:3000  # or wherever your MCP server runs
```

The MCP server must expose these tools (returning normalized JSON):
- `list_tasks` → `Task[]`
- `list_projects` → `Project[]`
- `list_goals` → `Goal[]` (optional)
- `update_task` → `Task`
- `create_task` → `Task`

MCP servers exist for: Things 3, OmniFocus, Apple Reminders, Asana, Linear, and more.

## Normalized types

All providers map their data to these types (see `src/providers/types.ts`):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Provider-internal ID |
| `shortId` | `number \| null` | Short numeric ID (/done 42). Null if unsupported. |
| `title` | `string` | Task name |
| `status` | `TaskStatus` | `'not_started' \| 'in_progress' \| 'done' \| ...` |
| `priority` | `string \| null` | `'p1'` = highest |
| `dueDate` | `string \| null` | ISO date (YYYY-MM-DD) |
| `scheduledDate` | `string \| null` | ISO date (YYYY-MM-DD) |
| `projectId` | `string \| null` | ID of linked project |
| `url` | `string` | Deep link into source app |
| `completed` | `boolean` | Derived from status |
