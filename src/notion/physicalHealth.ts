
import { search, queryDatabaseFiltered, createPage, updatePage, getDate, NotionPage } from './client';

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

interface HealthExport {
    data: {
        metrics: {
            name: string;
            units: string;
            data: { date: string; qty: number; source?: string }[]
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
            const qty = entry.qty;

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
                case 'apple_stand_time':
                    // minutes -> hours
                    stats.standHours += qty / 60;
                    break;
                case 'apple_exercise_time':
                    stats.exerciseTime += qty; // minutes
                    break;
                case 'flights_climbed':
                    stats.flights += qty;
                    break;
                case 'body_mass':
                    // Average later
                    stats.weight += qty;
                    stats.weightCount++;
                    break;
                case 'body_fat_percentage':
                    stats.bodyFat += qty; // usually 0-1 or 0-100?
                    stats.bodyFatCount++;
                    break;
                case 'body_mass_index':
                    stats.bmi += qty;
                    stats.bmiCount++;
                    break;
                case 'sleep_analysis':
                    // Special handling: if name contains 'sleep'
                    if (metric.name.includes('sleep')) {
                         // If min, /60.
                         if (metric.units === 'min') stats.sleepTotal = stats.sleepTotal + (qty / 60);
                         else stats.sleepTotal += qty;
                    }
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

    // Construct properties
    const props: Record<string, any> = {
        'Date': { date: { start: stats.date } },
        'Steps': { number: Math.round(stats.steps) },
        'Active Energy': { number: Math.round(stats.activeEnergy) },
        'Resting Energy': { number: Math.round(stats.restingEnergy) },
        'Stand Hours': { number: Number(stats.standHours.toFixed(1)) },
        'Exercise Time': { number: Math.round(stats.exerciseTime) },
        'Flights Climbed': { number: stats.flights },
        'Weight': { number: Number(stats.weight.toFixed(1)) },
        'Body Fat': { number: Number(stats.bodyFat.toFixed(1)) },
        'BMI': { number: Number(stats.bmi.toFixed(1)) },
        'Sleep Total': { number: Number(stats.sleepTotal.toFixed(1)) }
    };

    if (existingPage) {
        // Update
        await updatePage(existingPage.id, props);
    } else {
        // Create
        props['Log'] = { title: [{ text: { content: stats.date } }] };
        await createPage(dbId, props);
    }
}

// ─── Fetching ────────────────────────────────────────────────────────────────

export interface NotionMetric {
    name: string;
    data: { date: string; qty: number }[];
    units: string;
}

export interface MetricsResponse {
    metrics: NotionMetric[];
    dateRange: { from: string; to: string };
}

export async function fetchHealthMetrics(names: string[], from?: string, to?: string): Promise<MetricsResponse> {
    const dbId = await getHealthDatabaseId();

    // Build filter
    const filters: any[] = [];
    if (from) filters.push({ property: 'Date', date: { on_or_after: from } });
    if (to) filters.push({ property: 'Date', date: { on_or_before: to } });

    const filter = filters.length > 0 ? { and: filters } : undefined;
    const sorts = [{ property: 'Date', direction: 'ascending' }];

    // Query pages
    const pages = await queryDatabaseFiltered(dbId, filter, sorts, 100);

    const results: NotionMetric[] = [];

    // Map Notion property name <-> Internal metric name
    const map: Record<string, string> = {
        'step_count': 'Steps',
        'active_energy': 'Active Energy',
        'basal_energy_burned': 'Resting Energy',
        'apple_stand_hour': 'Stand Hours',
        'apple_exercise_time': 'Exercise Time',
        'flights_climbed': 'Flights Climbed',
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
        'apple_exercise_time': 'min',
        'flights_climbed': 'count',
        'body_mass': 'kg',
        'body_fat_percentage': '%',
        'body_mass_index': 'count',
        'sleep_analysis': 'hr'
    };

    for (const name of names) {
        const propName = map[name];
        if (!propName) continue;

        const data: { date: string; qty: number }[] = [];

        for (const page of pages) {
            const date = getDate(page, 'Date');
            if (!date) continue;

            const val = page.properties?.[propName]?.number;
            // Only add if value exists (not null)
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
