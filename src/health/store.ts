/**
 * Health Data Store — File-based storage for Apple Health exports
 *
 * Saves incoming JSON payloads as timestamped files under data/health/.
 * No schema validation — designed to capture unknown shapes for inspection.
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data', 'health');

/** Ensure the storage directory exists on module load */
function ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

ensureDir();

export interface ExportMeta {
    filename: string;
    date: string;
    sizeBytes: number;
}

/**
 * Store a raw JSON payload to disk.
 * Returns the filename and byte size written.
 */
export function saveExport(data: unknown): { filename: string; sizeBytes: number } {
    ensureDir();
    const now = new Date();
    const filename = now.toISOString().replace(/[:.]/g, '-') + '.json';
    const filePath = path.join(DATA_DIR, filename);
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    return { filename, sizeBytes: Buffer.byteLength(content, 'utf-8') };
}

/**
 * List all stored exports, newest first.
 */
export function listExports(): ExportMeta[] {
    ensureDir();
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

    return files
        .map(filename => {
            const filePath = path.join(DATA_DIR, filename);
            const stats = fs.statSync(filePath);
            // Parse the date back from the filename format: 2026-02-15T19-13-32-000Z.json
            const dateStr = filename.replace('.json', '').replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
            return {
                filename,
                date: dateStr,
                sizeBytes: stats.size,
            };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Read a specific export by filename. Returns null if not found.
 */
export function getExport(filename: string): unknown | null {
    const safeName = path.basename(filename); // prevent directory traversal
    const filePath = path.join(DATA_DIR, safeName);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Get the most recent export's data. Returns null if no exports exist.
 */
export function getLatestExport(): { filename: string; data: unknown } | null {
    const exports = listExports();
    if (exports.length === 0) return null;
    const latest = exports[0];
    const data = getExport(latest.filename);
    return data ? { filename: latest.filename, data } : null;
}
