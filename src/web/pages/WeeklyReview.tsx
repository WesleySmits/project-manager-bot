import React, { useEffect, useState, useCallback } from 'react';
import { api, WeeklyReviewData } from '../client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format YYYY-MM-DD → "Mon 16 Feb" */
function fmtDate(iso: string): string {
    const d = new Date(iso + 'T12:00:00Z'); // noon UTC avoids timezone shift
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Get the Monday of the week containing `date` as YYYY-MM-DD. */
function getMondayStr(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDay(); // 0=Sun … 6=Sat
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
}

/** Move one week forward/backward from a YYYY-MM-DD Monday string. */
function shiftWeek(mondayStr: string, direction: 1 | -1): string {
    const d = new Date(mondayStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + direction * 7);
    return d.toISOString().slice(0, 10);
}

const PRIORITY_BADGE: Record<string, string> = {
    High: 'badge-red',
    Medium: 'badge-yellow',
    Low: 'badge-gray',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionProps {
    icon: string;
    title: string;
    count: number;
    children: React.ReactNode;
    emptyText: string;
}

function ReviewSection({ icon, title, count, children, emptyText }: SectionProps) {
    return (
        <div className="card fade-in" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{icon}</span>
                <span>{title}</span>
                <span className="badge" style={{ marginLeft: 'auto', background: count > 0 ? 'var(--accent)' : 'var(--border)', color: count > 0 ? '#fff' : 'var(--text-secondary)', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>{count}</span>
            </div>
            <div className="card-body">
                {count === 0
                    ? <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>{emptyText}</p>
                    : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{children}</ul>
                }
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WeeklyReview() {
    const [weekStart, setWeekStart] = useState<string>(() => getMondayStr(new Date()));
    const [data, setData] = useState<WeeklyReviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (week: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.weeklyReview(week);
            setData(result);
            setWeekStart(result.weekStart); // normalise to what the server returned
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load weekly review');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(weekStart); }, []);  // load current week on mount

    const goToPrevWeek = () => {
        const prev = shiftWeek(weekStart, -1);
        setWeekStart(prev);
        void load(prev);
    };

    const goToNextWeek = () => {
        const next = shiftWeek(weekStart, 1);
        const currentMonday = getMondayStr(new Date());
        if (next > currentMonday) return; // don't navigate into the future
        setWeekStart(next);
        void load(next);
    };

    const isCurrentWeek = weekStart === getMondayStr(new Date());

    // ── Render ──────────────────────────────────────────────────────────────

    const weekLabel = data
        ? `${fmtDate(data.weekStart)} – ${fmtDate(data.weekEnd)}`
        : '…';

    const totalCompleted = (data?.totals.tasks ?? 0) + (data?.totals.projects ?? 0) + (data?.totals.goals ?? 0);

    return (
        <>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <h1>Weekly Review</h1>

                {/* Week navigator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={goToPrevWeek} disabled={loading} title="Previous week">←</button>
                    <span style={{ fontWeight: 600, minWidth: 200, textAlign: 'center', fontSize: 14 }}>{weekLabel}</span>
                    <button
                        className="btn btn-secondary"
                        onClick={goToNextWeek}
                        disabled={loading || isCurrentWeek}
                        title={isCurrentWeek ? 'Already on current week' : 'Next week'}
                    >→</button>
                    {!isCurrentWeek && (
                        <button className="btn btn-secondary" onClick={() => { const m = getMondayStr(new Date()); setWeekStart(m); void load(m); }} disabled={loading} title="Jump to current week">
                            Today
                        </button>
                    )}
                </div>
            </header>

            <div className="page-body">
                {loading && (
                    <div className="loading-state"><span className="spinner" /> Loading review…</div>
                )}

                {error && !loading && (
                    <div className="card" style={{ borderColor: 'var(--red)' }}>
                        <div className="card-body" style={{ color: 'var(--red)' }}>⚠️ {error}</div>
                    </div>
                )}

                {data && !loading && (
                    <>
                        {/* Summary bar */}
                        <div className="metrics-grid fade-in" style={{ marginBottom: 24 }}>
                            <div className="metric-card">
                                <div className="metric-label">Total Completed</div>
                                <div className="metric-value accent">{totalCompleted}</div>
                                <div className="metric-trend">this week</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Tasks</div>
                                <div className="metric-value">{data.totals.tasks}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Projects</div>
                                <div className="metric-value">{data.totals.projects}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Goals</div>
                                <div className="metric-value">{data.totals.goals}</div>
                            </div>
                        </div>

                        {totalCompleted === 0 && (
                            <div className="card fade-in" style={{ marginBottom: 24, borderColor: 'var(--border)' }}>
                                <div className="card-body" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 0' }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                                    <div>Nothing completed this week yet.</div>
                                    <div style={{ fontSize: 13, marginTop: 4 }}>Items appear here once they have a <strong>Completed Date</strong> in Notion.</div>
                                </div>
                            </div>
                        )}

                        {/* Goals */}
                        <ReviewSection icon="◎" title="Goals" count={data.totals.goals} emptyText="No goals completed this week.">
                            {data.goals.map(g => (
                                <li key={g.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                                        🏆 {g.title}
                                    </a>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8, whiteSpace: 'nowrap' }}>{fmtDate(g.completedDate)}</span>
                                </li>
                            ))}
                        </ReviewSection>

                        {/* Projects */}
                        <ReviewSection icon="▣" title="Projects" count={data.totals.projects} emptyText="No projects completed this week.">
                            {data.projects.map(p => (
                                <li key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}>
                                        ✅ {p.title}
                                    </a>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8, whiteSpace: 'nowrap' }}>{fmtDate(p.completedDate)}</span>
                                </li>
                            ))}
                        </ReviewSection>

                        {/* Tasks */}
                        <ReviewSection icon="☰" title="Tasks" count={data.totals.tasks} emptyText="No tasks completed this week.">
                            {data.tasks.map(t => (
                                <li key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        <span style={{ color: 'var(--accent)' }}>✓</span>
                                        <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {t.title}
                                        </a>
                                        {t.priority && (
                                            <span className={`badge ${PRIORITY_BADGE[t.priority] ?? 'badge-gray'}`} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, flexShrink: 0 }}>
                                                {t.priority}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDate(t.completedDate)}</span>
                                </li>
                            ))}
                        </ReviewSection>
                    </>
                )}
            </div>
        </>
    );
}
