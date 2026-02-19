# CLAUDE.md — Project Manager Bot

This file is the entry point for AI agents (Claude and others) working in this repository.

## Documentation Index

| Document | Description |
|---|---|
| [README.md](./README.md) | Project overview, deployment, and development setup |
| [docs/API.md](./docs/API.md) | Complete REST API reference for AI agent consumption |
| [WEB_INTERFACE_README.md](./WEB_INTERFACE_README.md) | Web dashboard architecture |
| [ROADMAP.md](./ROADMAP.md) | Planned features and milestones |

---

## What This Project Is

A **hybrid Telegram Bot + Web Dashboard** for personal project management backed by Notion.

- **Bot**: Telegram-based command interface (`/today_tasks`, `/strategy`, `/improve`, etc.)
- **API**: JWT-authenticated REST API for tasks, projects, goals, analytics, and health data
- **Dashboard**: React SPA for visual management and AI-driven insights
- **AI**: Google Gemini integration for strategic advice and motivation

Data lives in Notion databases (no SQL). Health data is stored locally as JSON.

---

## Repository Layout

```
index.ts                  # Main entry: Express server + Telegram bot
src/
  ai/gemini.ts            # Google Gemini AI integration
  analytics/              # Daily metrics collection and snapshot storage
  commands/               # Telegram bot command handlers
  health/                 # Apple Health data store
  middleware/expressAuth.ts  # JWT auth middleware
  notion/client.ts        # Notion API wrapper (raw HTTP, paginated)
  notion/health.ts        # Workspace health diagnostics
  pm/strategy.ts          # Strategic analysis engine
  routes/
    api.ts                # Core REST API (tasks, projects, goals, AI)
    auth.ts               # Login/logout
    analytics.ts          # Analytics history and summary
    healthData.ts         # Apple Health data endpoints
  web/                    # React frontend (Vite, TypeScript)
scripts/                  # Utility scripts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24+, TypeScript |
| Backend | Express v5, Telegraf v4 |
| Frontend | React 19, Vite 7, React Router 7 |
| Data | Notion API (raw HTTP), Local JSON |
| AI | Google Gemini (`@google/generative-ai`) |
| Auth | JWT (HTTP-only cookies), 7-day expiry |
| Container | Docker (Alpine-based) |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **Yes** | Telegram bot API token |
| `NOTION_TOKEN` | **Yes** | Notion integration secret |
| `NOTION_TASKS_DB` | **Yes** | Notion Tasks database ID |
| `NOTION_PROJECTS_DB` | **Yes** | Notion Projects database ID |
| `NOTION_GOALS_DB` | **Yes** | Notion Goals database ID |
| `JWT_SECRET` | **Yes** | JWT signing secret — use a long random string |
| `NOTION_HEALTH_DB_ID` | No | Notion Health Metrics database ID |
| `API_KEY` | No | Static API key for machine callers (Openclaw, scripts). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ALLOWED_ORIGIN` | No | CORS allowed origin (default: `http://localhost:5173`) |
| `BASIC_AUTH_USER` | No | Web login username |
| `BASIC_AUTH_PASS` | No | Web login password |
| `GEMINI_API_KEY` | No | Google Gemini API key |
| `PORT` | No | Server port (default: 3301) |
| `NODE_ENV` | No | `production` or `development` |

The app will **refuse to start** if any of the required variables are missing.

---

## Key Conventions

- **No SQL database.** All structured data comes from Notion via API.
- **No caching layer.** Every API request queries Notion live (except analytics snapshots).
- **Notion property access is permissive.** `client.ts` uses `Record<string, any>` and helper functions (`getTitle`, `getDate`, `isCompleted`, etc.) to normalize Notion's property format.
- **Project status is centralized.** Always use `getProjectStatusCategory()`, `isActiveProject()`, `isBlocked()`, `isEvergreen()` from `src/notion/client.ts` — do not hardcode status strings.
- **Pagination.** `queryDatabase()` automatically handles Notion's cursor-based pagination.
- **Health/API route ordering.** In `index.ts`, `/api/auth` is registered before `jwtAuthMiddleware`, so login is always public. `/api/health` is also exempted inside the middleware.

---

## Development Commands

```bash
npm install                          # Install all dependencies
npm run build                        # Full build (TypeScript + Vite)
npm run build:server                 # Backend only (tsc)
npm run build:web                    # Frontend only (vite build)
npm run dev:web                      # Vite dev server (port 5173, proxies /api → 3301)
node dist/index.js                   # Run built server
```

---

## Adding a New API Endpoint

1. Add route handler to the appropriate file in `src/routes/`
2. Import and use Notion helpers from `src/notion/client.ts`
3. Serialize response using the existing `serializeTask/Project/Goal` pattern
4. Register the route in `index.ts` if it's a new router module
5. Document it in `docs/API.md`

## Adding a New Telegram Command

1. Add handler function (async, takes `ctx: Context`)
2. Register with `bot.command('name', handler)` in `index.ts`
3. Add to `bot.telegram.setMyCommands([...])` array in `index.ts`
