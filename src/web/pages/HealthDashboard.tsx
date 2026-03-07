import React, { useEffect, useState, useMemo } from 'react';
import { api, type MetricsResponse, type MetricData } from '../client';

import MiniChart from '../components/MiniChart';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Set default font to our CSS var (requires getting computed style or hardcoding 'Inter')
ChartJS.defaults.font.family = '"Space Grotesk", sans-serif';
ChartJS.defaults.color = '#a1a1aa'; // var(--text-secondary)
ChartJS.defaults.scale.grid.color = '#27272a'; // var(--border-default)

// ─── Date Range Helpers ──────────────────────────────────────────────────────

type RangeKey = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'ytd' | 'all';

interface RangeOption {
    key: RangeKey;
    label: string;
    getRange: () => { from: string; to: string };
}

function fmt(d: Date): string {
    return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date): Date {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    return new Date(d.getFullYear(), d.getMonth(), diff);
}

const RANGE_OPTIONS: RangeOption[] = [
    {
        key: 'this_week', label: 'This Week',
        getRange: () => { const now = new Date(); return { from: fmt(startOfWeek(now)), to: fmt(now) }; },
    },
    {
        key: 'last_week', label: 'Last Week',
        getRange: () => {
            const now = new Date();
            const thisMonday = startOfWeek(now);
            const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
            const lastSunday = new Date(thisMonday); lastSunday.setDate(lastSunday.getDate() - 1);
            return { from: fmt(lastMonday), to: fmt(lastSunday) };
        },
    },
    {
        key: 'this_month', label: 'This Month',
        getRange: () => { const n = new Date(); return { from: fmt(new Date(n.getFullYear(), n.getMonth(), 1)), to: fmt(n) }; },
    },
    {
        key: 'last_month', label: 'Last Month',
        getRange: () => {
            const n = new Date();
            const first = new Date(n.getFullYear(), n.getMonth() - 1, 1);
            const last = new Date(n.getFullYear(), n.getMonth(), 0);
            return { from: fmt(first), to: fmt(last) };
        },
    },
    {
        key: 'ytd', label: 'Year to Date',
        getRange: () => { const n = new Date(); return { from: `${n.getFullYear()}-01-01`, to: fmt(n) }; },
    },
    {
        key: 'all', label: 'All Time',
        getRange: () => ({ from: '', to: '' }),
    },
];

// All metric names we need to fetch
const ALL_METRICS = [
    'apple_exercise_time', 'apple_stand_hour', 'active_energy', 'basal_energy_burned',
    'flights_climbed', 'step_count',
    'body_fat_percentage', 'body_mass_index', 'weight_body_mass',
    'sleep_analysis',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findMetric(metrics: MetricData[], name: string): MetricData | undefined {
    return metrics.find(m => m.name === name);
}

function sumQty(data: Array<Record<string, unknown>>): number {
    return data.reduce((sum, d) => sum + (typeof d.qty === 'number' ? d.qty : 0), 0);
}

function avgQty(data: Array<Record<string, unknown>>): number {
    if (data.length === 0) return 0;
    return sumQty(data) / data.length;
}

function formatNum(n: number, decimals = 0): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toFixed(decimals);
}

function kJtoKcal(kj: number): number {
    return kj / 4.184;
}

function toDateKey(raw: string): string {
    return raw.split(' ')[0];
}

function buildYearDays(year: number): string[] {
    const days: string[] = [];
    const d = new Date(year, 0, 1);
    while (d.getFullYear() === year) {
        days.push(fmt(d));
        d.setDate(d.getDate() + 1);
    }
    return days;
}

function aggregateMetricByDay(metric: MetricData | undefined): Map<string, number> {
    const map = new Map<string, number>();
    if (!metric) return map;
    for (const row of metric.data) {
        const date = typeof row.date === 'string' ? toDateKey(row.date) : String(row.date ?? '');
        if (!date) continue;
        const qty = typeof row.qty === 'number' ? row.qty : 0;
        map.set(date, (map.get(date) || 0) + qty);
    }
    return map;
}

interface HeatmapCalendar {
    weeks: number;
    cells: Array<{ date: string | null }>;
    monthMarkers: Array<{ label: string; column: number }>;
}

function dayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function buildHeatmapCalendar(year: number): HeatmapCalendar {
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const totalDays = dayOfYear(dec31) + 1;

    // Monday=0 ... Sunday=6
    const startOffset = (jan1.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
    const weeks = totalCells / 7;

    const cells: Array<{ date: string | null }> = Array.from({ length: totalCells }, () => ({ date: null }));
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(year, 0, 1 + i);
        cells[startOffset + i] = { date: fmt(d) };
    }

    const monthMarkers: Array<{ label: string; column: number }> = [];
    for (let m = 0; m < 12; m++) {
        const d = new Date(year, m, 1);
        const idx = startOffset + dayOfYear(d);
        const column = Math.floor(idx / 7) + 1;
        const label = d.toLocaleDateString(undefined, { month: 'short' });
        monthMarkers.push({ label, column });
    }

    return { weeks, cells, monthMarkers };
}

function GoalHeatmap({
    title,
    year,
    values,
    goal,
    color,
    unit,
}: {
    title: string;
    year: number;
    values: Map<string, number>;
    goal: number;
    color: string;
    unit: string;
}) {
    const calendar = useMemo(() => buildHeatmapCalendar(year), [year]);
    const reached = calendar.cells.filter(c => c.date && (values.get(c.date) || 0) >= goal).length;

    return (
        <section className="goal-grid-card" aria-label={`${title} progress`}>
            <header className="goal-grid-header">
                <h3>{title}</h3>
                <p>{reached}/{calendar.cells.filter(c => c.date).length} days hit goal ({goal} {unit})</p>
            </header>

            <div className="goal-grid-months" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${calendar.weeks}, minmax(0, 1fr))` }}>
                {calendar.monthMarkers.map(m => (
                    <span key={`${title}-${m.label}-${m.column}`} className="goal-grid-month-label" style={{ gridColumnStart: m.column }}>{m.label}</span>
                ))}
            </div>

            <ol className="goal-grid" role="list" style={{ gridTemplateColumns: `repeat(${calendar.weeks}, minmax(0, 1fr))` }}>
                {calendar.cells.map((cell, idx) => {
                    if (!cell.date) {
                        return <li key={`${title}-empty-${idx}`} className="goal-grid-cell is-empty" aria-hidden="true" />;
                    }

                    const value = values.get(cell.date) || 0;
                    const pct = goal > 0 ? (value / goal) * 100 : 0;
                    let level = 0;
                    if (value > 0 && pct < 50) level = 1;
                    else if (pct >= 50 && pct < 100) level = 2;
                    else if (pct >= 100) level = 3;

                    const alphaByLevel = [0.06, 0.28, 0.55, 0.95];
                    const alpha = alphaByLevel[level];
                    const tooltip = `${cell.date}: ${value.toFixed(0)} ${unit} (${pct.toFixed(0)}% of goal)`;

                    return (
                        <li key={`${title}-${cell.date}`} className="goal-grid-cell">
                            <time
                                dateTime={cell.date}
                                className="goal-grid-day"
                                style={{ backgroundColor: `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, #0f0f12)` }}
                                aria-label={`${cell.date}: ${value.toFixed(0)} ${unit}${value >= goal ? ', goal reached' : ''}`}
                            />
                            <span className="goal-grid-tooltip" role="tooltip">{tooltip}</span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HealthDashboard() {
    const [range, setRange] = useState<RangeKey>('this_month');
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [data, setData] = useState<MetricsResponse | null>(null);
    const [yearData, setYearData] = useState<MetricsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const currentRange = useMemo(() => {
        if (range === 'ytd') {
            const now = new Date();
            const to = year === now.getFullYear() ? fmt(now) : `${year}-12-31`;
            return { from: `${year}-01-01`, to };
        }
        const opt = RANGE_OPTIONS.find(o => o.key === range)!;
        return opt.getRange();
    }, [range, year]);

    useEffect(() => {
        setLoading(true);
        api.healthMetrics(ALL_METRICS, currentRange.from || undefined, currentRange.to || undefined)
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [currentRange.from, currentRange.to]);

    useEffect(() => {
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;
        api.healthMetrics(ALL_METRICS, from, to)
            .then(setYearData)
            .catch(() => setYearData(null));
    }, [year]);

    const metrics = data?.metrics ?? [];
    const yearMetrics = yearData?.metrics ?? [];
    const yearlyData = useMemo(() => ({
        activity: aggregateMetricByDay(findMetric(yearMetrics, 'apple_exercise_time')),
        calories: aggregateMetricByDay(findMetric(yearMetrics, 'active_energy')),
        standing: aggregateMetricByDay(findMetric(yearMetrics, 'apple_stand_hour')),
        steps: aggregateMetricByDay(findMetric(yearMetrics, 'step_count')),
    }), [yearMetrics]);

    // ─── Stats ───────────────────────────────────────────────────────────────
    const exerciseTime = findMetric(metrics, 'apple_exercise_time');
    const standHour = findMetric(metrics, 'apple_stand_hour');
    const basalEnergy = findMetric(metrics, 'basal_energy_burned');
    const flights = findMetric(metrics, 'flights_climbed');
    const steps = findMetric(metrics, 'step_count');

    // ─── Physique ────────────────────────────────────────────────────────────
    const bodyFat = findMetric(metrics, 'body_fat_percentage');
    const bmi = findMetric(metrics, 'body_mass_index');
    const weight = findMetric(metrics, 'weight_body_mass');

    // ─── Sleep ───────────────────────────────────────────────────────────────
    const sleep = findMetric(metrics, 'sleep_analysis');

    return (
        <>
            <header className="page-header">
                <h1>Health Dashboard</h1>
            </header>
            <div className="page-body">

                {/* Date Range Selector */}
                <div className="hd-range-bar fade-in">
                    {RANGE_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            className={`hd-range-pill ${range === opt.key ? 'active' : ''}`}
                            onClick={() => setRange(opt.key)}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <div className="hd-year-toggle" role="group" aria-label="Select year">
                        <button className="hd-range-pill" onClick={() => setYear(y => y - 1)}>&larr;</button>
                        <span>{year}</span>
                        <button className="hd-range-pill" onClick={() => setYear(y => Math.min(new Date().getFullYear(), y + 1))}>&rarr;</button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state"><span className="spinner" /> Loading health data…</div>
                ) : (
                    <>
                        <section className="section fade-in stagger-1">
                            <div className="section-title">🎯 Daily Goal Completion</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
                                GitHub-style yearly activity grids for your ring goals.
                            </p>
                            <div className="goal-grid-stack">
                                <GoalHeatmap
                                    title="Daily Activity"
                                    year={year}
                                    values={yearlyData.activity}
                                    goal={30}
                                    unit="min"
                                    color="#32D74B"
                                />
                                <GoalHeatmap
                                    title="Daily Calories Burned"
                                    year={year}
                                    values={yearlyData.calories}
                                    goal={500}
                                    unit="kcal"
                                    color="#FF453A"
                                />
                                <GoalHeatmap
                                    title="Daily Standing Hours"
                                    year={year}
                                    values={yearlyData.standing}
                                    goal={12}
                                    unit="hrs"
                                    color="#00C7BE"
                                />
                                <GoalHeatmap
                                    title="Daily Steps"
                                    year={year}
                                    values={yearlyData.steps}
                                    goal={10000}
                                    unit="steps"
                                    color="#0A84FF"
                                />
                            </div>
                        </section>

                        {/* ─── Stats ──────────────────────────────────────────── */}
                        <div className="section fade-in stagger-1">
                            <div className="section-title">🏃 Activity</div>
                            <div className="metrics-grid">
                                <StatCard
                                    label="Exercise Time"
                                    value={exerciseTime ? formatNum(sumQty(exerciseTime.data)) : '—'}
                                    unit="min total"
                                    sub={exerciseTime ? `${formatNum(avgQty(exerciseTime.data))} min/day avg` : undefined}
                                    color="var(--green)"
                                />
                                <StatCard
                                    label="Stand Hours"
                                    value={standHour ? formatNum(sumQty(standHour.data)) : '—'}
                                    unit="hrs total"
                                    sub={standHour ? `${formatNum(avgQty(standHour.data), 1)} hrs/day avg` : undefined}
                                    color="var(--accent)"
                                />
                                <StatCard
                                    label="Basal Energy"
                                    value={basalEnergy ? formatNum(kJtoKcal(avgQty(basalEnergy.data))) : '—'}
                                    unit="kcal/day avg"
                                    color="var(--orange)"
                                />
                                <StatCard
                                    label="Flights Climbed"
                                    value={flights ? formatNum(sumQty(flights.data)) : '—'}
                                    unit="total"
                                    sub={flights ? `${formatNum(avgQty(flights.data), 1)}/day avg` : undefined}
                                    color="var(--yellow)"
                                />
                                <StatCard
                                    label="Steps"
                                    value={steps ? formatNum(sumQty(steps.data)) : '—'}
                                    unit="total"
                                    sub={steps ? `${formatNum(avgQty(steps.data))} avg/day` : undefined}
                                    color="var(--accent)"
                                />
                            </div>
                        </div>

                        {/* ─── Physique ────────────────────────────────────────── */}
                        <div className="section fade-in stagger-2">
                            <div className="section-title">🏋️ Physique</div>
                            <div className="three-col">
                                <div className="card">
                                    <div className="card-header"><h2>Body Fat %</h2></div>
                                    <div className="card-body">
                                        <MiniChart
                                            data={(bodyFat?.data ?? []).map(d => ({ date: String(d.date), value: d.qty as number }))}
                                            color="#fb923c" // var(--orange)
                                            formatValue={v => v.toFixed(1) + '%'}
                                        />
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="card-header"><h2>BMI</h2></div>
                                    <div className="card-body">
                                        <MiniChart
                                            data={(bmi?.data ?? []).map(d => ({ date: String(d.date), value: d.qty as number }))}
                                            color="#818cf8" // var(--accent)
                                            formatValue={v => v.toFixed(1)}
                                        />
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="card-header"><h2>Weight</h2></div>
                                    <div className="card-body">
                                        <MiniChart
                                            data={(weight?.data ?? []).map(d => ({ date: String(d.date), value: d.qty as number }))}
                                            color="#4ade80" // var(--green)
                                            formatValue={v => v.toFixed(1) + ' kg'}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ─── Sleep ───────────────────────────────────────────── */}
                        <div className="section fade-in stagger-3">
                            <div className="section-title">😴 Sleep</div>
                            {(!sleep || sleep.data.length === 0) ? (
                                <div className="card">
                                    <div className="card-body">
                                        <div className="empty-state">No sleep data in this range</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="two-col">
                                    {/* Sleep chart — total sleep per night */}
                                    <div className="card">
                                        <div className="card-header"><h2>Total Sleep</h2></div>
                                        <div className="card-body">
                                            <MiniChart
                                                data={sleep.data.map(d => ({
                                                    date: String(d.date),
                                                    value: (d.totalSleep as number) ?? (d.asleep as number) ?? 0,
                                                }))}
                                                color="#a78bfa"
                                                formatValue={v => {
                                                    const hrs = Math.floor(v);
                                                    const mins = Math.round((v - hrs) * 60);
                                                    return `${hrs}h ${mins}m`;
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {/* Sleep breakdown cards */}
                                    <div className="card">
                                        <div className="card-header"><h2>Latest Breakdown</h2></div>
                                        <div className="card-body">
                                            <SleepBreakdown entry={sleep.data[sleep.data.length - 1]} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, unit, sub, color }: {
    label: string; value: string; unit: string; sub?: string; color: string;
}) {
    return (
        <div className="metric-card">
            <div className="metric-label">{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <div className="metric-value" style={{ color }}>{value}</div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{unit}</span>
            </div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function SleepBreakdown({ entry }: { entry: Record<string, unknown> }) {
    const stages = [
        { key: 'deep', label: 'Deep', color: '#6366f1' },
        { key: 'core', label: 'Core', color: '#818cf8' },
        { key: 'rem', label: 'REM', color: '#a78bfa' },
        { key: 'awake', label: 'Awake', color: '#f87171' },
    ];

    const totalSleep = (entry.totalSleep as number) ?? (entry.asleep as number) ?? 0;
    const hrs = Math.floor(totalSleep);
    const mins = Math.round((totalSleep - hrs) * 60);

    return (
        <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: '#a78bfa', marginBottom: 12 }}>
                {hrs}h {mins}m
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stages.map(s => {
                    const val = (entry[s.key] as number) ?? 0;
                    const pct = totalSleep > 0 ? (val / totalSleep) * 100 : 0;
                    const h = Math.floor(val);
                    const m = Math.round((val - h) * 60);
                    return (
                        <div key={s.key}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', color: s.color }}>
                                    {val > 0 ? `${h}h ${m}m` : '—'}
                                </span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${pct}%`, background: s.color }} />
                            </div>
                        </div>
                    );
                })}
            </div>
            {typeof entry.sleepStart === 'string' && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>
                    {entry.sleepStart.slice(11, 16)} → {String(entry.sleepEnd).slice(11, 16)}
                </div>
            )}
        </div>
    );
}
