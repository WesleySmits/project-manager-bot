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
