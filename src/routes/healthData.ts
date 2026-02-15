/**
 * Health Data API Routes
 *
 * Endpoints for receiving and viewing Apple Health Auto Export data.
 * POST /           — receive and store a raw JSON export
 * GET  /exports    — list all stored exports
 * GET  /exports/:filename — retrieve a specific export
 * GET  /latest     — retrieve the most recent export
 */
import { Router, Request, Response } from 'express';
import { saveExport, listExports, getExport, getLatestExport } from '../health/store';

const router = Router();

/** Receive a health data export from Apple Health Auto Export */
router.post('/', (req: Request, res: Response) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            res.status(400).json({ error: 'Empty request body' });
            return;
        }

        const { filename, sizeBytes } = saveExport(req.body);

        console.log(`📥 Health data received: ${filename} (${(sizeBytes / 1024).toFixed(1)} KB)`);

        res.json({
            status: 'ok',
            filename,
            sizeBytes,
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
