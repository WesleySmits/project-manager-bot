# Project Manager Bot — REST API Reference

This document is intended for AI agents (Claude, GPT, custom automation) and developers integrating with the Project Manager Bot API.

**Base URL**: `https://pm.wesleysmits.com` (or `http://localhost:3301` in development)

---

## Authentication

The API supports **two authentication schemes**. Both protect the same set of endpoints. Use whichever fits your client:

| Scheme                                         | Best for                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| **API Key** (`Authorization: Bearer <key>`)    | Machine-to-machine callers (Openclaw, scripts, cron jobs) |
| **JWT cookie** (`auth_token` HTTP-only cookie) | Browser sessions (the web dashboard)                      |

Both schemes are accepted on every protected endpoint — a request authenticated by either one is allowed through.

---

### API Key Authentication (for Openclaw and automation)

Set `API_KEY` in your environment to enable this scheme. Then send the key on every request using one of:

```http
Authorization: Bearer <your-api-key>
```

```http
X-API-Key: <your-api-key>
```

**Example:**

```bash
curl -H "Authorization: Bearer mysecretkey" https://pm.wesleysmits.com/api/dashboard
```

If `API_KEY` is not set in the environment, the scheme is silently disabled (the middleware is a no-op) and only JWT is accepted.

**Generating a strong key:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:

```
API_KEY=your-generated-hex-key-here
```

---

### JWT Cookie Authentication (for the browser dashboard)

### Login Flow

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

**Response** `200 OK`:

```json
{
  "success": true,
  "user": { "username": "your-username" }
}
```

The server sets an `auth_token` HTTP-only cookie (expires: 7 days). All subsequent requests must include this cookie.

### Check Auth Status

```http
GET /api/auth/me
```

**Response** `200 OK` (authenticated):

```json
{
  "authenticated": true,
  "user": { "username": "your-username", "iat": 1234567890, "exp": 1235172690 }
}
```

**Response** `200 OK` (not authenticated):

```json
{ "authenticated": false }
```

### Logout

```http
POST /api/auth/logout
```

Clears the auth cookie. Returns `200 OK`.

---

## Public Endpoints

These endpoints require **no authentication**.

### System Health Check

```http
GET /api/health
```

Use this to verify the API is running.

**Response** `200 OK`:

```json
{
  "status": "ok",
  "service": "project-manager",
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

---

## Protected Endpoints

All endpoints below require authentication via **API key** or **JWT cookie**. Without valid credentials, the API returns `401 Unauthorized`.

---

## Dashboard

### Get Dashboard Data

```http
GET /api/dashboard
```

Aggregated view: metrics, today's tasks, overdue items, and today's impact on goals/projects.

**Response** `200 OK`:

```json
{
  "metrics": {
    "activeTasks": 12,
    "totalTasks": 45,
    "activeProjects": 4,
    "totalProjects": 18,
    "activeGoals": 3,
    "totalGoals": 7,
    "healthIssues": 2
  },
  "todayTasks": [
    {
      "id": "page-uuid",
      "title": "Write project proposal",
      "status": "In Progress",
      "priority": "High",
      "dueDate": "2026-01-15",
      "scheduledDate": "2026-01-15",
      "hasProject": true,
      "completed": false,
      "url": "https://notion.so/..."
    }
  ],
  "overdueTasks": [...],
  "todayImpact": {
    "projectsAffected": [
      {
        "title": "Product Launch Q1",
        "url": "https://notion.so/...",
        "taskCount": 3
      }
    ],
    "goalsAffected": [
      {
        "title": "Grow revenue 30%",
        "url": "https://notion.so/...",
        "progress": 42,
        "projectsInGoal": 5
      }
    ]
  }
}
```

---

## Tasks

### List All Tasks

```http
GET /api/tasks
```

Returns all tasks (active and completed).

**Response** `200 OK` — array of task objects:

```json
[
  {
    "id": "page-uuid",
    "title": "Write project proposal",
    "status": "In Progress",
    "priority": "High",
    "dueDate": "2026-01-15",
    "scheduledDate": "2026-01-14",
    "hasProject": true,
    "completed": false,
    "url": "https://notion.so/..."
  }
]
```

**Task object fields:**

| Field           | Type           | Description                                              |
| --------------- | -------------- | -------------------------------------------------------- |
| `id`            | string         | Notion page UUID                                         |
| `title`         | string         | Task title                                               |
| `status`        | string \| null | Notion status name (e.g., "In Progress", "Done")         |
| `priority`      | string \| null | Select value (e.g., "High", "Medium", "Low")             |
| `dueDate`       | string \| null | ISO date string (YYYY-MM-DD)                             |
| `scheduledDate` | string \| null | ISO date string                                          |
| `hasProject`    | boolean        | Whether the task is linked to a project                  |
| `completed`     | boolean        | True if status matches done/completed/cancelled/canceled |
| `url`           | string         | Direct Notion URL                                        |

### Get Task by Short ID

```http
GET /api/tasks/short/:id
```

Returns a single task using its Notion simple integer ID (the `Task ID` property).

**Path parameters:**

| Parameter | Required | Description                     |
| --------- | -------- | ------------------------------- |
| `id`      | Yes      | The integer ID (e.g. `31`)      |

**Response** `200 OK` — task object (same schema as above):

```json
{
  "id": "page-uuid",
  "title": "Write project proposal",
  "status": "In Progress",
  "priority": "High",
  "dueDate": "2026-01-15",
  "scheduledDate": "2026-01-14",
  "hasProject": true,
  "completed": false,
  "url": "https://notion.so/..."
}
```

### Update Task Status by Short ID

```http
PATCH /api/tasks/short/:id/status
Content-Type: application/json

{
  "status": "Done"
}
```

Updates the status of a task using its short numeric ID.

**Request body:**

| Field    | Type   | Description                                   |
| -------- | ------ | --------------------------------------------- |
| `status` | string | Exact name of the status in Notion (case-sensitive) |

**Response** `200 OK` — returns the updated task object.

---

## Projects

### List All Projects

```http
GET /api/projects
```

Returns all projects with active task counts.

**Response** `200 OK`:

```json
[
  {
    "id": "page-uuid",
    "title": "Product Launch Q1",
    "status": "In Progress",
    "statusCategory": "ACTIVE",
    "blocked": false,
    "active": true,
    "evergreen": false,
    "description": "Launch the new product in Q1 2026",
    "url": "https://notion.so/...",
    "taskCount": 5
  }
]
```

**Project object fields:**

| Field            | Type           | Description                                                           |
| ---------------- | -------------- | --------------------------------------------------------------------- |
| `id`             | string         | Notion page UUID                                                      |
| `title`          | string         | Project title                                                         |
| `status`         | string \| null | Raw Notion status name                                                |
| `statusCategory` | string         | Normalized: `ACTIVE`, `READY`, `BACKLOG`, `PARKED`, `DONE`, `UNKNOWN` |
| `blocked`        | boolean        | Whether the "Blocked?" checkbox is checked                            |
| `active`         | boolean        | True if `ACTIVE` status + not blocked + not evergreen                 |
| `evergreen`      | boolean        | Whether the "Evergreen" checkbox is checked                           |
| `description`    | string \| null | Project description text                                              |
| `url`            | string         | Direct Notion URL                                                     |
| `taskCount`      | number         | Count of linked active tasks                                          |

**Status categories:**

| Category  | Raw Status Values                            |
| --------- | -------------------------------------------- |
| `ACTIVE`  | "in progress"                                |
| `READY`   | "ready to start", "ready for review"         |
| `BACKLOG` | "backlog"                                    |
| `PARKED`  | "parked", "on hold"                          |
| `DONE`    | "done", "completed", "cancelled", "canceled" |

### Get Actionable Projects

```http
GET /api/projects/actionable
```

Projects that can be worked on today: `ACTIVE` status, not blocked, not evergreen.

**Response** `200 OK`:

```json
{
  "count": 3,
  "projects": [
    {
      "id": "page-uuid",
      "title": "Product Launch Q1",
      "status": "In Progress",
      "statusCategory": "ACTIVE",
      "blocked": false,
      "active": true,
      "evergreen": false,
      "description": "...",
      "url": "https://notion.so/...",
      "taskCount": 5,
      "lastUpdated": "2026-01-10T14:22:00.000Z",
      "daysSinceUpdate": 5,
      "stalled": false
    }
  ]
}
```

Additional fields on actionable projects:

| Field             | Type    | Description                       |
| ----------------- | ------- | --------------------------------- |
| `lastUpdated`     | string  | ISO timestamp of last Notion edit |
| `daysSinceUpdate` | number  | Days since last edit              |
| `stalled`         | boolean | True if `daysSinceUpdate > 14`    |

### Get Blocked Projects

```http
GET /api/projects/blocked
```

Projects waiting on external dependencies (Active/Ready status + "Blocked?" = true).

**Response** `200 OK`:

```json
{
  "count": 1,
  "projects": [
    {
      "id": "page-uuid",
      "title": "Waiting on Legal Approval",
      "statusCategory": "ACTIVE",
      "blocked": true,
      "taskCount": 2,
      "lastUpdated": "2026-01-05T09:00:00.000Z",
      "daysSinceUpdate": 10,
      "needsFollowUp": true
    }
  ]
}
```

Additional field:

| Field           | Type    | Description                   |
| --------------- | ------- | ----------------------------- |
| `needsFollowUp` | boolean | True if `daysSinceUpdate > 7` |

### Get Project Summary

```http
GET /api/projects/summary
```

High-level project overview for briefings and dashboards.

**Response** `200 OK`:

```json
{
  "overview": {
    "actionable": 4,
    "blocked": 2,
    "evergreen": 3,
    "stalled": 1,
    "total": 9
  },
  "actionableProjects": [
    {
      "title": "Product Launch Q1",
      "url": "https://notion.so/...",
      "taskCount": 5
    }
  ],
  "blockedProjects": [
    {
      "title": "Waiting on Legal",
      "url": "https://notion.so/...",
      "daysSinceUpdate": 10
    }
  ],
  "stalledProjects": [
    {
      "title": "Old Project",
      "url": "https://notion.so/...",
      "daysSinceUpdate": 21
    }
  ],
  "metrics": {
    "actionableTaskCount": 18,
    "avgTasksPerActionableProject": "4.5"
  }
}
```

---

## Goals

### List All Goals

```http
GET /api/goals
```

Returns all incomplete goals with progress percentages.

**Response** `200 OK`:

```json
[
  {
    "id": "page-uuid",
    "title": "Grow revenue 30%",
    "completed": false,
    "description": "Increase annual revenue by 30% through new product lines",
    "url": "https://notion.so/...",
    "progress": 42,
    "projectCount": 5,
    "completedProjects": 2
  }
]
```

**Goal object fields:**

| Field               | Type           | Description                                            |
| ------------------- | -------------- | ------------------------------------------------------ |
| `id`                | string         | Notion page UUID                                       |
| `title`             | string         | Goal title                                             |
| `completed`         | boolean        | Whether the goal is marked done                        |
| `description`       | string \| null | Goal description                                       |
| `url`               | string         | Direct Notion URL                                      |
| `progress`          | number         | Completion percentage (0–100) based on linked projects |
| `projectCount`      | number         | Total linked projects                                  |
| `completedProjects` | number         | Number of done/completed linked projects               |

---

## Analysis

### Workspace Health Check

```http
GET /api/analysis/health
```

Diagnostic report of workspace data quality issues.

**Response** `200 OK`:

```json
{
  "totals": {
    "tasks": 45,
    "projects": 18,
    "goals": 7
  },
  "issues": {
    "orphanedTasks": [...],
    "projectsWithoutGoal": [...],
    "overdueDueDate": [...],
    "overdueScheduled": [...],
    "missingRequiredFields": [...],
    "missingDescription": [...],
    "projectsMissingDescription": [...]
  }
}
```

Each issue list contains serialized task or project objects (see schemas above).

### Strategic Analysis

```http
GET /api/analysis/strategy
```

Focus and momentum analysis: stalled goals, zombie projects, overload detection.

**Response** `200 OK`:

```json
{
  "metrics": {
    "activeGoalsCount": 3,
    "activeProjectsCount": 4,
    "activeTasksCount": 12,
    "focusScore": 85
  },
  "issues": {
    "stalledGoals": [...],
    "zombieProjects": [...],
    "isOverloaded": false
  },
  "progress": [
    {
      "id": "goal-uuid",
      "title": "Grow revenue 30%",
      "percent": 42,
      "total": 5,
      "completed": 2
    }
  ]
}
```

**Strategic concepts:**

| Term           | Definition                                 |
| -------------- | ------------------------------------------ |
| Stalled goal   | Goal with no active projects linked to it  |
| Zombie project | Active project with no active tasks        |
| Overloaded     | More than 5 active projects simultaneously |
| Focus score    | Metric measuring sustainable workload      |

---

## AI Endpoints

Both AI endpoints require `GEMINI_API_KEY` to be set. If the key is missing, they return an error.

### Generate Strategic Insight

```http
POST /api/ai/insight
```

Analyzes current stalled goals and zombie projects, then generates actionable advice via Gemini.

No request body required.

**Response** `200 OK`:

```json
{
  "insight": "Your main focus should be resolving the 2 stalled goals..."
}
```

**Error Response** `500`:

```json
{ "error": "Failed to generate insight" }
```

### Generate Motivational Message

```http
POST /api/ai/motivation
```

Generates a motivational message based on today's tasks and active goals.

No request body required.

**Response** `200 OK`:

```json
{
  "motivation": "Today you're making real progress on Product Launch Q1..."
}
```

---

## Analytics

### Get Analytics History

```http
GET /api/analytics/history
```

Returns all historical daily snapshots.

**Response** `200 OK` — array of snapshots:

```json
[
  {
    "date": "2026-01-15",
    "collectedAt": "2026-01-15T08:00:00.000Z",
    "completionRates": {
      "today": 60,
      "week": 45,
      "month": 38
    },
    "projectCompletion": 25
  }
]
```

### Get Latest Analytics Summary

```http
GET /api/analytics/summary
```

Returns the most recent snapshot. If no snapshot exists for today, triggers a live collection.

**Response**: Same shape as a single snapshot object above.

### Force Analytics Refresh

```http
POST /api/analytics/refresh
```

Forces immediate collection of new metrics regardless of existing snapshots.

**Response**: The newly collected snapshot object.

---

## Health Data (Apple Health)

### Submit Health Export

```http
POST /api/health-data/
Content-Type: application/json

{
  "data": [
    {
      "name": "StepCount",
      "units": "count",
      "data": [
        { "date": "2026-01-15 08:00:00 +0100", "qty": 5432 }
      ]
    }
  ]
}
```

Used by the [Health Auto Export](https://github.com/Lybron/health-auto-export) iOS app. Saves the export to disk and optionally syncs to Notion.

**Response** `200 OK`:

```json
{ "status": "ok", "saved": "2026-01-15T08-00-00.json" }
```

### Query Health Metrics

```http
GET /api/health-data/metrics?name=StepCount&start=2026-01-01&end=2026-01-15
```

**Query parameters:**

| Parameter | Required | Description                                            |
| --------- | -------- | ------------------------------------------------------ |
| `name`    | No       | Filter by metric name (e.g., `StepCount`, `HeartRate`) |
| `start`   | No       | Start date (ISO: `YYYY-MM-DD`)                         |
| `end`     | No       | End date (ISO: `YYYY-MM-DD`)                           |

**Response** `200 OK`:

```json
[
  {
    "date": "2026-01-15 08:00:00 +0100",
    "qty": 5432,
    "metric": "StepCount"
  }
]
```

### List Health Exports

```http
GET /api/health-data/exports
```

Returns a list of all stored health export filenames.

**Response** `200 OK`:

```json
["2026-01-15T08-00-00.json", "2026-01-14T08-01-00.json"]
```

### Get Specific Export

```http
GET /api/health-data/exports/:filename
```

Returns the raw content of a specific export file.

### Get Latest Export

```http
GET /api/health-data/latest
```

Returns the most recently saved export.

---

## Error Handling

All endpoints return errors in the same shape:

```json
{ "error": "Human-readable error message" }
```

| HTTP Status | Meaning                                           |
| ----------- | ------------------------------------------------- |
| `200`       | Success                                           |
| `401`       | Not authenticated (missing or invalid JWT cookie) |
| `500`       | Server error (Notion API failure, AI error, etc.) |

---

## Usage Patterns for AI Agents

### Morning Briefing Pattern

Fetch today's situation in 3 calls:

```
GET /api/dashboard         → today's tasks + overdue + impact
GET /api/analysis/strategy → stalled goals + zombie projects
GET /api/projects/summary  → actionable / blocked / stalled counts
```

### Focus Audit Pattern

```
GET /api/analysis/strategy → identify issues
POST /api/ai/insight       → get actionable AI advice
```

### Full Workspace Snapshot

```
GET /api/tasks
GET /api/projects
GET /api/goals
GET /api/analysis/health
GET /api/analytics/summary
```

### Health Data Pipeline

External iOS health app → `POST /api/health-data/` on schedule → stored and synced to Notion.

---

## Rate Limiting & Caching Notes

- **No rate limiting** is enforced by the API itself. Notion API limits apply (3 req/s per integration).
- **5-minute in-memory cache** on task/project/goal reads — repeated calls within 5 minutes return cached data without hitting Notion. Cache is invalidated on writes (`POST` endpoints that create or update Notion pages).
- **Analytics** snapshots are collected once per day by the scheduler. The `/api/analytics/summary` endpoint triggers live collection only if no snapshot exists at all. Use `/api/analytics/refresh` for a forced live fetch.
- AI endpoints (`/api/ai/*`) call Gemini on each request. Be mindful of token costs.

---

## Data Model Relationships

```
Goals (1)
  └── Projects (many, via "Projects" relation)
        └── Tasks (many, via "Project" relation)
```

- A goal has progress based on what fraction of its linked projects are done.
- A task "affects" a goal if the task's project is linked to that goal.
- "Stalled goal" = a goal with zero active (non-blocked, non-evergreen, in-progress) projects.
- "Zombie project" = an active project with zero incomplete tasks.
