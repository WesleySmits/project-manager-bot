import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'analytics_history.json');

export interface AnalyticsSnapshot {
    date: string; // ISO Date YYYY-MM-DD
    timestamp: string; // ISO DateTime
    metrics: {
        tasksCompletedToday: number;
        tasksCompletedThisWeek: number;
        tasksCompletedThisMonth: number;
        projectsCompletedThisWeek: number;
        projectsCompletedThisMonth: number;
        avgTaskCompletionDays: number;
        avgProjectCompletionDays: number;
        avgTaskActiveDays: number;
        activeTasksCount: number; // Active > 7 days
        activeProjectsCount: number;
    };
}

/**
 * Ensure data directory exists
 */
async function ensureDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

/**
 * Save a new snapshot to history
 */
export async function saveSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
    await ensureDir();
    let history: AnalyticsSnapshot[] = [];

    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        history = JSON.parse(data);
    } catch (error) {
        // File might not exist or be empty, start fresh
    }

    // Remove existing snapshot for the same day if exists (overwrite daily entry)
    history = history.filter(s => s.date !== snapshot.date);
    history.push(snapshot);

    // Sort by date
    history.sort((a, b) => a.date.localeCompare(b.date));

    await fs.writeFile(DATA_FILE, JSON.stringify(history, null, 2));
}

/**
 * Get full history
 */
export async function getHistory(): Promise<AnalyticsSnapshot[]> {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

/**
 * Get latest snapshot
 */
export async function getLatestSnapshot(): Promise<AnalyticsSnapshot | null> {
    const history = await getHistory();
    return history.length > 0 ? history[history.length - 1] : null;
}
