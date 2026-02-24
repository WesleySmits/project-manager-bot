# Project Manager Bot

A hybrid Telegram Bot and Web Dashboard for managing tasks, projects, and goals in Notion, with AI-driven insights.

## Architecture

- **Backend**: Node.js + Express + Telegraf (Telegram Bot)
- **Frontend**: React + Vite (Web Dashboard)
- **Data**: Notion API + Local JSON storage for Health Data

## Deployment

The application is containerized using Docker.

### ⚠️ Critical Data Persistence

The application stores Apple Health export data in `/app/data`. **You must mount a persistent volume** to this path to prevent data loss during deployments.

**Dokploy Configuration:**

- **Volumes**:
  - Host Path: `/path/to/persistent/data` (e.g., `/project-manager/data`)
  - Container Path: `/app/data`

If this volume is not configured, all health data history will be lost on every redeploy.

## Configuration

The application requires several environment variables to function. Create a `.env` file in the root directory based on `.env.example`.

### Environment Variables

| Variable | Description | How to Get |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Token for the Telegram Bot | Message [@BotFather](https://t.me/botfather) on Telegram. |
| `TELEGRAM_CHAT_ID` | Your Telegram User ID | Message [@userinfobot](https://t.me/userinfobot) or similar. |
| `NOTION_TOKEN` | Notion API Integration Token | Create an integration at [Notion My-Integrations](https://www.notion.so/my-integrations). |
| `NOTION_TASKS_DB` | ID of the Tasks database | Copy the ID from the database URL in Notion. |
| `NOTION_PROJECTS_DB` | ID of the Projects database | Copy the ID from the database URL in Notion. |
| `NOTION_GOALS_DB` | ID of the Goals database | Copy the ID from the database URL in Notion. |
| `GEMINI_API_KEY` | Google Gemini AI API Key | Get it from [Google AI Studio](https://aistudio.google.com/). |
| `BASIC_AUTH_USER` | Web Interface Username | Any username you choose for login. |
| `BASIC_AUTH_PASS` | Web Interface Password | Any strong password you choose. |
| `API_KEY` | Internal API Security Key | Generate a random 64-char hex string. |
| `JWT_SECRET` | Secret for JWT Tokens | Generate another random 64-char hex string. |

## Notion Setup

To replicate the exact setup, you can use Notion AI to create the databases. Use the following prompts:

### 1. Goals Database
> "Create a 'Goals' database with the following properties: 'Name' (Title), 'Status' (Status: In Progress, Done), 'Completed Date' (Date), 'Description' (Rich Text), and a Relation to a 'Projects' database."

### 2. Projects Database
> "Create a 'Projects' database with the following properties: 'Name' (Title), 'Status' (Select: Backlog, Ready to Start, In Progress, Ready for Review, Done, Parked), 'Goal' (Relation to Goals), 'Blocked?' (Checkbox), 'Evergreen' (Checkbox), 'Completed Date' (Date), 'Description' (Rich Text), and a Relation to a 'Tasks' database."

### 3. Tasks Database
> "Create a 'Tasks' database with the following properties: 'Name' (Title), 'Status' (Status: To Do, In Progress, Done, Cancelled), 'Priority' (Select: P0, P1, P2, P3), 'Project' (Relation to Projects), 'Due Date' (Date), 'Scheduled' (Date), 'Task ID' (Unique ID), and 'Description' (Rich Text)."

## Apple Health Integration

1. Use the [Health Auto Export](https://github.com/Lybron/health-auto-export) app (or similar) on iOS.
2. Configure it to POST JSON data to `https://pm.wesleysmits.com/api/health-data`.
3. Valid exports will be saved to `data/health/` and visualized on the dashboard.

## Development

```bash
# Install dependencies
npm install

# Run backend (dev)
npm run build:server && node dist/index.js

# Run frontend (dev)
npm run dev:web
```
