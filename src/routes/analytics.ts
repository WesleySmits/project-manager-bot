import { Router, Request, Response } from 'express';
import { getHistory, getLatestSnapshot } from '../analytics/store';
import { collectDailyMetrics } from '../analytics/collector';
import { Temporal } from '@js-temporal/polyfill';

const router = Router();

/**
 * Get historical analytics data
 */
router.get('/history', async (_req: Request, res: Response) => {
    try {
        const history = await getHistory();
        res.json(history);
    } catch (error) {
        console.error('Error fetching analytics history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * Get latest summary (cached snapshot)
 * If no snapshot exists for today, it triggers a collection (optional, or just returns old data)
 * For now, just returns latest snapshot. Frontend can trigger refresh if needed.
 */
router.get('/summary', async (_req: Request, res: Response) => {
    try {
        let snapshot = await getLatestSnapshot();

        // If no snapshot at all, try to collect one
        if (!snapshot) {
            snapshot = await collectDailyMetrics();
        }

        res.json(snapshot);
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

/**
 * Force refresh of analytics data (Manual Trigger)
 */
router.post('/refresh', async (_req: Request, res: Response) => {
    try {
        const snapshot = await collectDailyMetrics();
        res.json(snapshot);
    } catch (error) {
        console.error('Error refreshing analytics:', error);
        res.status(500).json({ error: 'Failed to refresh analytics' });
    }
});

export default router;
