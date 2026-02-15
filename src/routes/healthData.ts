/**
 * Health Data API Routes
 *
 * Endpoints for receiving and viewing Apple Health Auto Export data.
 * POST /           — receive, store to disk, and sync to Notion
 * GET  /exports    — list all stored exports
 * GET  /exports/:filename — retrieve a specific export
 * GET  /latest     — retrieve the most recent export
 * GET  /metrics    — retrieve aggregated metrics from Notion
 */
import { Router, Request, Response } from 'express';
import { saveExport, listExports, getExport, getLatestExport } from '../health/store';
// import { getMetrics } from '../health/metrics'; // Legacy file-based
import { syncHealthData, fetchHealthMetrics } from '../notion/physicalHealth';

const router = Router();

/** Query metrics from Notion by name and optional date range */
router.get('/metrics', async (req: Request, res: Response) => {
    try {
        const namesParam = req.query.names as string | undefined;
        if (!namesParam) {
            res.status(400).json({ error: 'Missing required query parameter: names' });
            return;
        }
        const names = namesParam.split(',').map(n => n.trim()).filter(Boolean);
        const from = req.query.from as string | undefined;
        const to = req.query.to as string | undefined;

        const result = await fetchHealthMetrics(names, from, to);
        res.json(result);
    } catch (err) {
        console.error('Health metrics error:', err);
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: `Failed to query health metrics: ${message}` });
    }
});

/** Receive a health data export from Apple Health Auto Export */
router.post('/', async (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            res.status(400).json({ error: 'Empty request body' });
            return;
        }

        // 1. Save to disk (Backup)
        const { filename, sizeBytes } = saveExport(req.body);
        console.log(`📥 Health data received: ${filename} (${(sizeBytes / 1024).toFixed(1)} KB)`);

        // 2. Sync to Notion (Primary)
        let notionSync = { synced: 0, errors: 0 };
        try {
            console.log('🔄 Syncing to Health Metrics Notion DB...');
            notionSync = await syncHealthData(req.body);
            console.log(`✅ Synced ${notionSync.synced} days to Notion (${notionSync.errors} errors)`);
        } catch (syncErr) {
            console.error('⚠️ Notion sync failed:', syncErr);
            // We don't fail the request because we successfully saved the file
        }

        res.json({
            status: 'ok',
            filename,
            sizeBytes,
            notion: notionSync,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Health data POST error:', err);
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: `Failed to store health data: ${message}` });
    }
});

/** List all stored health exports */
router.get('/exports', (_req: Request, res: Response) => {
    try {
        const exports = listExports();
        res.json({ exports, total: exports.length });
    } catch (err) {
        console.error('Health data list error:', err);
        res.status(500).json({ error: 'Failed to list health exports' });
    }
});

/** Retrieve a specific export by filename */
router.get('/exports/:filename', (req: Request, res: Response) => {
    try {
        const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
        const data = getExport(filename);
        if (!data) {
            res.status(404).json({ error: 'Export not found' });
            return;
        }
        res.json(data);
    } catch (err) {
        console.error('Health data get error:', err);
        res.status(500).json({ error: 'Failed to read health export' });
    }
});

/** Retrieve the latest export */
router.get('/latest', (_req: Request, res: Response) => {
    try {
        const result = getLatestExport();
        if (!result) {
            res.status(404).json({ error: 'No health exports found' });
            return;
        }
        res.json(result);
    } catch (err) {
        console.error('Health data latest error:', err);
        res.status(500).json({ error: 'Failed to read latest health export' });
    }
});

export default router;
