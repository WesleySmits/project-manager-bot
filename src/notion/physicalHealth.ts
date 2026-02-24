import { search, queryDatabaseFiltered, createPage, updatePage, getDate, NotionPage, NotionFilter, NotionSort, NotionPropertyValue, getNumber } from './client';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

let HEALTH_DB_ID: string | null = process.env.NOTION_HEALTH_DB_ID || null;

/**
 * Find the Health Metrics database ID if not already known
 */
async function getHealthDatabaseId(): Promise<string> {
    if (HEALTH_DB_ID) return HEALTH_DB_ID;

    // Search for "Health Metrics"
    const results = await search('Health Metrics', 10);
    const db = results.find(r => r.object === 'database' && !r.archived);

    if (!db) {
        throw new Error('Could not find a Notion database named "Health Metrics". Please create it and share it with the integration.');
    }

    HEALTH_DB_ID = db.id;
    console.log(`Found Health Metrics DB: ${HEALTH_DB_ID}`);
    return HEALTH_DB_ID;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

interface HealthExportDataPoint {
    date: string;
    qty?: number;
    source?: string;
    // Sleep specific fields
    asleep?: number;
    inBed?: number;
    core?: number;
    deep?: number;
    rem?: number;
    awake?: number;
    totalSleep?: number;
}

interface HealthExport {
    data: {
        metrics: {
            name: string;
            units: string;
            data: HealthExportDataPoint[]
        }[]
    }
}

interface DailyStats {
    date: string; // YYYY-MM-DD
    steps: number;
    activeEnergy: number; // kcal
    restingEnergy: number; // kcal
    standHours: number;
    exerciseTime: number; // min
    flights: number;
    weight: number; // kg
    bodyFat: number; // %
    bmi: number;
    sleepDeep: number; // hours
    sleepCore: number; // hours
    sleepRem: number; // hours
    sleepAwake: number; // hours
    sleepTotal: number; // hours
    // Counts for averaging
    weightCount: number;
    bodyFatCount: number;
    bmiCount: number;
}

function getDay(dateStr: string): string {
    return dateStr.split(' ')[0]; // "2026-01-01 00:00:00 ..." -> "2026-01-01"
}

/**
 * Sync health data from export to Notion
 */
export async function syncHealthData(exportData: HealthExport): Promise<{ synced: number, errors: number }> {
    if (DEMO_MODE) {
        console.log('DEMO MODE: Simulating health data sync', exportData);
        return { synced: 10, errors: 0 };
    }
    const dbId = await getHealthDatabaseId();
    const metrics = exportData.data?.metrics || [];
    const dailyMap = new Map<string, DailyStats>();

    // Initializer
    const getStats = (date: string): DailyStats => {
        if (!dailyMap.has(date)) {
            dailyMap.set(date, {
                date,
                steps: 0,
                activeEnergy: 0,
                restingEnergy: 0,
                standHours: 0,
                exerciseTime: 0,
                flights: 0,
                weight: 0,
                bodyFat: 0,
                bmi: 0,
                sleepDeep: 0,
                sleepCore: 0,
                sleepRem: 0,
                sleepAwake: 0,
                sleepTotal: 0,
                weightCount: 0,
                bodyFatCount: 0,
                bmiCount: 0,
            });
        }
        return dailyMap.get(date)!;
    };

    for (const metric of metrics) {
        for (const entry of metric.data) {
            const day = getDay(entry.date);
            const stats = getStats(day);
            const qty = entry.qty || 0;

            switch (metric.name) {
                case 'step_count':
                    stats.steps += qty;
                    break;
                case 'active_energy':
                    // Convert to kcal if kJ
                    stats.activeEnergy += metric.units === 'kJ' ? qty * 0.239006 : qty;
                    break;
                case 'basal_energy_burned':
                    stats.restingEnergy += metric.units === 'kJ' ? qty * 0.239006 : qty;
                    break;
                case 'apple_stand_hour':
                case 'apple_stand_time': // Handle both, prefer hour logic if it allows count
                    // If apple_stand_time comes as min, we might want to convert to hours?
                    // But if apple_stand_hour is present, it's the count.
                    // Let's assume apple_stand_hour is authoritative for "Rings".
                    // If this is 'apple_stand_hour' (count), just add it.
                    if (metric.name === 'apple_stand_hour') {
                         stats.standHours += qty;
                    } else {
                        // apple_stand_time (duration in min)
                        // Ignore for now to avoid double counting if both exist,
                        // or if only this exists, convert.
                        // Safe bet: if standHours is 0, use this / 60.
                        // But verifying order is hard.
                        // Let's rely on apple_stand_hour (count) mainly.
                    }
                    break;
                case 'apple_exercise_time':
                    stats.exerciseTime += qty; // minutes
                    break;
                case 'flights_climbed':
                    stats.flights += qty;
                    break;
                case 'weight_body_mass':
                case 'body_mass':
                    if (qty > 0) {
                        stats.weight += qty;
                        stats.weightCount++;
                    }
                    break;
                case 'body_fat_percentage':
                    if (qty > 0) {
                        stats.bodyFat += qty; // usually 0-100
                        stats.bodyFatCount++;
                    }
                    break;
                case 'body_mass_index':
                    if (qty > 0) {
                        stats.bmi += qty;
                        stats.bmiCount++;
                    }
                    break;
                case 'sleep_analysis':
                    // Handle breakdown
                    stats.sleepTotal += entry.totalSleep || 0;
                    stats.sleepDeep += entry.deep || 0;
                    stats.sleepCore += entry.core || 0;
                    stats.sleepRem += entry.rem || 0;
                    stats.sleepAwake += entry.awake || 0;
                    break;
            }
        }
    }

    // Process averages and aggregation
    let synced = 0;
    let errors = 0;

    // Process chronologically
    const sortedDates = Array.from(dailyMap.keys()).sort();

    for (const date of sortedDates) {
        const s = dailyMap.get(date)!;

        // Finalize averages
        if (s.weightCount > 0) s.weight /= s.weightCount;
        if (s.bodyFatCount > 0) s.bodyFat /= s.bodyFatCount;
        if (s.bmiCount > 0) s.bmi /= s.bmiCount;

        // Upsert to Notion
        try {
            await upsertDailyEntry(dbId, s);
            synced++;
        } catch (e) {
            console.error(`Failed to sync health data for ${date}:`, e);
            errors++;
        }
    }

    return { synced, errors };
}

async function upsertDailyEntry(dbId: string, stats: DailyStats) {
    // Check if entry exists
    const query = await queryDatabaseFiltered(dbId, {
        property: 'Date',
        date: { equals: stats.date }
    }, [], 1);

    const existingPage = query[0];

    // Construct properties — shape matches Notion write API
    const props: Record<string, NotionPropertyValue> = {
        'Date': { type: 'date', date: { start: stats.date, end: null } },
        'Steps': { type: 'number', number: Math.round(stats.steps) },
        'Active Energy': { type: 'number', number: Math.round(stats.activeEnergy) },
        'Resting Energy': { type: 'number', number: Math.round(stats.restingEnergy) },
        'Stand Hours': { type: 'number', number: Number(stats.standHours.toFixed(1)) },
        'Exercise Time': { type: 'number', number: Math.round(stats.exerciseTime) },
        'Flights Climbed': { type: 'number', number: stats.flights },
        'Weight': { type: 'number', number: stats.weightCount > 0 ? Number(stats.weight.toFixed(1)) : null },
        'Body Fat': { type: 'number', number: stats.bodyFatCount > 0 ? Number(stats.bodyFat.toFixed(1)) : null },
        'BMI': { type: 'number', number: stats.bmiCount > 0 ? Number(stats.bmi.toFixed(1)) : null },

        // Sleep breakdown
        'Sleep Total': { type: 'number', number: Number(stats.sleepTotal.toFixed(2)) },
        'Sleep Deep': { type: 'number', number: Number(stats.sleepDeep.toFixed(2)) },
        'Sleep Core': { type: 'number', number: Number(stats.sleepCore.toFixed(2)) },
        'Sleep REM': { type: 'number', number: Number(stats.sleepRem.toFixed(2)) },
        'Sleep Awake': { type: 'number', number: Number(stats.sleepAwake.toFixed(2)) },
    };

    if (existingPage) {
        await updatePage(existingPage.id, props);
    } else {
        props['Log'] = { type: 'title', title: [{ type: 'text', plain_text: stats.date, text: { content: stats.date }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' } }] } as any;
        // Note: 'title' structure in NotionPropertyValue is tricky, overriding 'any' to satisfy strict Record check or fixing NotionPropertyValue definition
        // NotionPropertyValue definition for title: title?: Array<{ plain_text: string }>;
        // But for creation we need the full text object structure.
        // Let's rely on 'any' cast for this one specific complex property or adjust the interface.
        // Actually, let's fix the property construction to match expected input.
        // The API expects: { title: [ { text: { content: "..." } } ] }
        // client.ts updatePage/createPage expects Record<string, NotionPropertyValue>
        // and NotionPropertyValue has title?: Array<{ plain_text: string }>; which is for OUTPUT.
        // Input structure is slightly different.

        // Let's use 'as any' for now to bypass strict check on the Log title which is an edge case.
        props['Log'] = {
            type: 'title',
            title: [{ text: { content: stats.date } }]
        } as any;

        await createPage(dbId, props);
    }
}

// ─── Fetching ────────────────────────────────────────────────────────────────

export interface NotionMetric {
    name: string;
    // Map to flexible record to support extra props like 'deep', 'core'
    data: Array<Record<string, unknown>>;
    units: string;
}

export interface MetricsResponse {
    metrics: NotionMetric[];
    dateRange: { from: string; to: string };
}

export async function fetchHealthMetrics(names: string[], from?: string, to?: string): Promise<MetricsResponse> {
    if (DEMO_MODE) {
        const { MOCK_HEALTH_METRICS } = await import('./mockData');
        return {
            ...MOCK_HEALTH_METRICS,
            dateRange: { from: from || '', to: to || '' }
        };
    }
    const dbId = await getHealthDatabaseId();

    // Build filter
    const filterClauses: NotionFilter[] = [];
    if (from) filterClauses.push({ property: 'Date', date: { on_or_after: from } });
    if (to) filterClauses.push({ property: 'Date', date: { on_or_before: to } });

    const filter: NotionFilter | undefined = filterClauses.length > 0 ? { and: filterClauses } : undefined;
    const sorts: NotionSort[] = [{ property: 'Date', direction: 'ascending' }];

    // Query pages
    const pages = await queryDatabaseFiltered(dbId, filter, sorts, 100);

    const results: NotionMetric[] = [];

    // Map Notion property name <-> Internal metric name
    const map: Record<string, string> = {
        'step_count': 'Steps',
        'active_energy': 'Active Energy',
        'basal_energy_burned': 'Resting Energy',
        'apple_stand_hour': 'Stand Hours',
        'apple_stand_time': 'Stand Hours', // Map both just in case
        'apple_exercise_time': 'Exercise Time',
        'flights_climbed': 'Flights Climbed',
        'weight_body_mass': 'Weight',
        'body_mass': 'Weight',
        'body_fat_percentage': 'Body Fat',
        'body_mass_index': 'BMI',
        'sleep_analysis': 'Sleep Total'
    };

    const unitsMap: Record<string, string> = {
        'step_count': 'count',
        'active_energy': 'kcal',
        'basal_energy_burned': 'kcal',
        'apple_stand_hour': 'hr',
        'apple_stand_time': 'hr',
        'apple_exercise_time': 'min',
        'flights_climbed': 'count',
        'body_mass': 'kg',
        'weight_body_mass': 'kg',
        'body_fat_percentage': '%',
        'body_mass_index': 'count',
        'sleep_analysis': 'hr'
    };

    for (const name of names) {
        const propName = map[name];
        if (!propName) continue;

        const data: Array<Record<string, unknown>> = [];

        for (const page of pages) {
            const date = getDate(page, 'Date');
            if (!date) continue;

            // Special handling for sleep
            if (name === 'sleep_analysis') {
                 const total = getNumber(page, 'Sleep Total') || 0;
                 const deep = getNumber(page, 'Sleep Deep') || 0;
                 const core = getNumber(page, 'Sleep Core') || 0;
                 const rem = getNumber(page, 'Sleep REM') || 0;
                 const awake = getNumber(page, 'Sleep Awake') || 0;

                 // If all zeros, maybe skip? or push 0.
                 data.push({
                     date,
                     qty: total,
                     totalSleep: total,
                     deep, core, rem, awake,
                     asleep: total // Fallback
                 });
                 continue;
            }

            const val = getNumber(page, propName);
            if (typeof val === 'number') {
                data.push({ date, qty: val });
            }
        }

        results.push({
            name,
            data,
            units: unitsMap[name] || ''
        });
    }

    return {
        metrics: results,
        dateRange: { from: from || '', to: to || '' }
    };
}
