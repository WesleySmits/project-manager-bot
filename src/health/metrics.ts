/**
 * Health Metrics — Reads stored exports and provides metric data by name/date range.
 *
 * Merges data across multiple export files, deduplicating entries by date+metric
 * so that overlapping exports (e.g. a bulk export followed by daily ones) combine cleanly.
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data', 'health');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetricEntry {
    date: string;
    [key: string]: unknown;
}

export interface Metric {
    name: string;
    units: string;
    data: MetricEntry[];
}

export interface MetricsResponse {
    metrics: Metric[];
    dateRange: { from: string; to: string };
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/** Normalise Apple Health date string (e.g. "2026-01-05 00:00:00 +0300") to YYYY-MM-DD */
function normaliseDate(raw: string): string {
    // Take just the date portion before the first space
    return raw.split(' ')[0];
}

/** Check if a normalised YYYY-MM-DD date falls within the range [from, to] inclusive */
function dateInRange(date: string, from?: string, to?: string): boolean {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Read all stored export files and extract the named metrics,
 * filtered to the given date range. Deduplicates entries by date.
 */
export function getMetrics(names: string[], from?: string, to?: string): MetricsResponse {
    if (!fs.existsSync(DATA_DIR)) {
        return { metrics: [], dateRange: { from: from ?? '', to: to ?? '' } };
    }

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

    // Accumulator: metricName → Map<normalisedDate, entry>
    const acc = new Map<string, { units: string; entries: Map<string, MetricEntry> }>();

    for (const name of names) {
        acc.set(name, { units: '', entries: new Map() });
    }

    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
            const parsed = JSON.parse(raw);

            // Navigate into the envelope: { data: { metrics: [...] } }
            const metrics: unknown[] = parsed?.data?.metrics ?? [];

            for (const m of metrics) {
                const metric = m as { name?: string; units?: string; data?: unknown[] };
                if (!metric.name || !names.includes(metric.name)) continue;

                const bucket = acc.get(metric.name)!;
                if (metric.units && !bucket.units) {
                    bucket.units = metric.units;
                }

                for (const entry of metric.data ?? []) {
                    const e = entry as MetricEntry;
                    if (!e.date) continue;

                    const normDate = normaliseDate(e.date);
                    if (!dateInRange(normDate, from, to)) continue;

                    // Store with normalised date; later entries overwrite earlier ones
                    bucket.entries.set(normDate, { ...e, date: normDate });
                }
            }
        } catch {
            // Skip unparseable files
        }
    }

    // Build response
    const metrics: Metric[] = names
        .filter(name => acc.has(name))
        .map(name => {
            const bucket = acc.get(name)!;
            const data = Array.from(bucket.entries.values())
                .sort((a, b) => a.date.localeCompare(b.date));
            return { name, units: bucket.units, data };
        });

    return { metrics, dateRange: { from: from ?? '', to: to ?? '' } };
}
