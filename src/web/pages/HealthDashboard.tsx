import React, { useEffect, useState, useMemo } from 'react';
import { api, type MetricsResponse, type MetricData } from '../client';
import MiniChart from '../components/MiniChart';

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
    'apple_exercise_time', 'apple_stand_hour', 'basal_energy_burned',
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function HealthDashboard() {
    const [range, setRange] = useState<RangeKey>('this_month');
    const [data, setData] = useState<MetricsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const currentRange = useMemo(() => {
        const opt = RANGE_OPTIONS.find(o => o.key === range)!;
        return opt.getRange();
    }, [range]);

    useEffect(() => {
        setLoading(true);
        api.healthMetrics(ALL_METRICS, currentRange.from || undefined, currentRange.to || undefined)
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [currentRange.from, currentRange.to]);

    const metrics = data?.metrics ?? [];

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
                </div>

                {loading ? (
                    <div className="loading-state"><span className="spinner" /> Loading health data…</div>
                ) : (
                    <>
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
                                            color="var(--orange)"
                                            formatValue={v => v.toFixed(1) + '%'}
                                        />
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="card-header"><h2>BMI</h2></div>
                                    <div className="card-body">
                                        <MiniChart
                                            data={(bmi?.data ?? []).map(d => ({ date: String(d.date), value: d.qty as number }))}
                                            color="var(--accent)"
                                            formatValue={v => v.toFixed(1)}
                                        />
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="card-header"><h2>Weight</h2></div>
                                    <div className="card-body">
                                        <MiniChart
                                            data={(weight?.data ?? []).map(d => ({ date: String(d.date), value: d.qty as number }))}
                                            color="var(--green)"
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
