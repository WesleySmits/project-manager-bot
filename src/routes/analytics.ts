import { Router, Request, Response } from 'express';
import { loadScoreState, manualAdjustScore, DailyScoreEntry } from '../analytics/score';
import { getCurrentScore, evaluateDate } from '../analytics/scoreEvaluator';
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

// ─── Score Routes ────────────────────────────────────────────────────────────

/** GET /api/analytics/score — current score + history */
router.get('/score', async (_req: Request, res: Response) => {
    try {
        const state = await loadScoreState();
        res.json({
            current: state.current,
            streak: state.streak,
            lastUpdated: state.lastUpdated,
            history: state.history.slice(-30), // last 30 days
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load score' });
    }
});

/** POST /api/analytics/score/evaluate — trigger evaluation for a date */
router.post('/score/evaluate', async (req: Request, res: Response) => {
    try {
        const { date } = req.body;
        const entry = await evaluateDate(date);
        if (!entry) return res.status(500).json({ error: 'Evaluation failed' });
        res.json(entry);
    } catch (err) {
        res.status(500).json({ error: 'Evaluation failed' });
    }
});

/** POST /api/analytics/score/adjust — manual adjustment */
router.post('/score/adjust', async (req: Request, res: Response) => {
    try {
        const { delta, reason, date } = req.body;
        if (typeof delta !== 'number') return res.status(400).json({ error: 'delta (number) is required' });
        const entry = await manualAdjustScore(delta, reason ?? 'Manual adjustment', date);
        const state = await loadScoreState();
        res.json({ entry, current: state.current, streak: state.streak });
    } catch (err) {
        res.status(500).json({ error: 'Failed to adjust score' });
    }
});

export default router;
