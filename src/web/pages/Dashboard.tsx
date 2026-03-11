import React, { useEffect, useState } from 'react';
import { api, DashboardData, PlanningOsSnapshot, DailyFocusData } from '../client';

function priorityClass(p: string | null): string {
    if (!p) return 'none';
    const l = p.toLowerCase();
    if (l.includes('high') || l.includes('p1') || l.includes('urgent')) return 'high';
    if (l.includes('medium') || l.includes('p2')) return 'medium';
    return 'low';
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [motivation, setMotivation] = useState<string | null>(null);
    const [motivationLoading, setMotivationLoading] = useState(false);
    const [planning, setPlanning] = useState<PlanningOsSnapshot | null>(null);
    const [dailyFocus, setDailyFocus] = useState<DailyFocusData | null>(null);

    useEffect(() => {
        Promise.all([api.dashboard(), api.planningOs(), api.dailyFocus()])
            .then(([d, p, f]) => { setData(d); setPlanning(p); setDailyFocus(f); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleMotivation = () => {
        setMotivationLoading(true);
        api.motivation().then(r => { setMotivation(r.motivation); setMotivationLoading(false); }).catch(() => setMotivationLoading(false));
    };

    if (loading) return <div className="loading-state"><span className="spinner" /> Loading dashboard…</div>;
    if (!data) return <div className="empty-state">Failed to load dashboard.</div>;

    const m = data.metrics;
    const impact = data.todayImpact;

    return (
        <>
            <header className="page-header"><h1>Dashboard</h1></header>
            <div className="page-body">

                {/* Metrics */}
                <div className="metrics-grid fade-in">
                    <div className="metric-card">
                        <div className="metric-label">Active Tasks</div>
                        <div className="metric-value">{m.activeTasks}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active Projects</div>
                        <div className="metric-value accent">{m.activeProjects}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active Goals</div>
                        <div className="metric-value green">{m.activeGoals}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Health Issues</div>
                        <div className={`metric-value ${m.healthIssues > 0 ? 'red' : 'green'}`}>{m.healthIssues}</div>
                    </div>
                </div>


                {/* Planning OS */}
                {planning && (
                    <div className="section fade-in stagger-1">
                        <div className="section-title">🧭 Planning OS Compliance</div>
                        <div className="card">
                            <div className="card-body">
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                    <span className={`badge ${planning.summary.violations > 0 ? 'high' : 'status-done'}`}>
                                        Violations: {planning.summary.violations}
                                    </span>
                                    <span className="badge none">Goals {planning.summary.activeGoals}/{planning.limits.activeGoalsMax}</span>
                                    <span className="badge none">Projects {planning.summary.activeProjects}</span>
                                    <span className="badge none">Tasks {planning.summary.activeTasks}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                    Category coverage: Professional {planning.categoryCoverage.Professional} · Personal {planning.categoryCoverage.Personal} · Health {planning.categoryCoverage.Health} · Wealth {planning.categoryCoverage.Wealth}
                                </div>
                                {planning.violations.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '8px 0' }}>System is within WIP and balance rules.</div>
                                ) : (
                                    <div className="issue-list">
                                        {planning.violations.map((v, i) => (
                                            <div key={i} className="issue-item">
                                                <span className="issue-dot red" />
                                                <span>{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Today's Impact — what you're actually achieving */}
                {impact && (impact.projectsAffected.length > 0 || impact.goalsAffected.length > 0) && (
                    <div className="section fade-in stagger-1">
                        <div className="section-title">🎯 Today's Impact</div>
                        <div className="card">
                            <div className="card-body">
                                {impact.projectsAffected.length > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 8 }}>
                                            Projects you're advancing
                                        </div>
                                        {impact.projectsAffected.map((p, i) => (
                                            <a key={i} href={p.url} target="_blank" rel="noreferrer" className="issue-item" style={{ textDecoration: 'none' }}>
                                                <span className="issue-dot accent" />
                                                <span style={{ flex: 1 }}>{p.title}</span>
                                                <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                                    {p.taskCount} task{p.taskCount !== 1 ? 's' : ''} today
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {impact.goalsAffected.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 8 }}>
                                            Goals you're progressing
                                        </div>
                                        {impact.goalsAffected.map((g, i) => (
                                            <a key={i} href={g.url} target="_blank" rel="noreferrer" className="issue-item" style={{ textDecoration: 'none' }}>
                                                <span className="issue-dot green" />
                                                <span style={{ flex: 1 }}>{g.title}</span>
                                                <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                                    {g.progress}% complete
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}



                {/* Category Lock (UI-only) */}
                {planning && (
                    <div className="section fade-in stagger-2">
                        <div className="section-title">🔒 Category Lock (UI-only)</div>
                        <div className="card">
                            <div className="card-body">
                                {(() => {
                                    const categories: Array<{ key: 'Professional' | 'Personal' | 'Health' | 'Wealth'; label: string }> = [
                                        { key: 'Professional', label: 'Professional' },
                                        { key: 'Personal', label: 'Personal' },
                                        { key: 'Health', label: 'Health' },
                                        { key: 'Wealth', label: 'Wealth' },
                                    ];
                                    const missing = categories.filter(c => (planning.categoryCoverage[c.key] ?? 0) < 1);
                                    const duplicated = categories.filter(c => (planning.categoryCoverage[c.key] ?? 0) > 1);

                                    return (
                                        <>
                                            {(missing.length > 0 || duplicated.length > 0) && (
                                                <div style={{ marginBottom: 10 }}>
                                                    <span className="badge high" style={{ marginRight: 8 }}>Needs rebalance</span>
                                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        {missing.length > 0 ? `Missing: ${missing.map(m => m.label).join(', ')}. ` : ''}
                                                        {duplicated.length > 0 ? `Over 1 active: ${duplicated.map(d => d.label).join(', ')}.` : ''}
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                                                {categories.map((c) => {
                                                    const value = planning.categoryCoverage[c.key] ?? 0;
                                                    const ok = value === 1;
                                                    const cls = ok ? 'status-done' : (value === 0 ? 'high' : 'medium');
                                                    return (
                                                        <div key={c.key} className="issue-item" style={{ borderRadius: 8 }}>
                                                            <span className={`badge ${cls}`}>{value}/1</span>
                                                            <span style={{ marginLeft: 8 }}>{c.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Today Focus (Planning OS Contract) */}
                <div className="section fade-in stagger-3">
                    <div className="section-title">🎯 Today Focus (Top 1 → Top 1 → Top 3)</div>
                    <div className="card">
                        <div className="card-body">
                            <div style={{ marginBottom: 12, display: 'grid', gap: 8 }}>
                                <div><strong>Top Goal:</strong> {dailyFocus?.topGoal ? <a href={dailyFocus.topGoal.url} target="_blank" rel="noreferrer">{dailyFocus.topGoal.title}</a> : 'Not identified yet — set an active focus goal.'}</div>
                                <div><strong>Top Project:</strong> {dailyFocus?.topProject ? <a href={dailyFocus.topProject.url} target="_blank" rel="noreferrer">{dailyFocus.topProject.title}</a> : 'Not identified yet — set an active project under the top goal.'}</div>
                            </div>
                            {!dailyFocus || dailyFocus.topTasks.length === 0 ? (
                                <div className="empty-state">No priority tasks found for today.</div>
                            ) : (
                                <div className="issue-list">
                                    {dailyFocus.topTasks.map((task, i) => (
                                        <a key={task.id} href={task.url} target="_blank" rel="noreferrer" className="issue-item" style={{ display: 'block', textDecoration: 'none' }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                                <span className="badge status-active">T{i + 1}</span>
                                                <span style={{ color: 'var(--text-primary)' }}>{task.title}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 4 }}>
                                                <div><strong>Why now:</strong> {task.whyNow}</div>
                                                <div><strong>Next action:</strong> {task.nextAction}</div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* AI Motivation */}
                <div className="section fade-in stagger-4">
                    <div className="section-title">💡 Why This Matters</div>
                    <div className="card">
                        <div className="card-body">
                            {motivation ? (
                                <div style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}
                                    dangerouslySetInnerHTML={{ __html: motivation.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary)">$1</strong>') }} />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                                    <button className="btn btn-primary" onClick={handleMotivation} disabled={motivationLoading}>
                                        {motivationLoading ? 'Thinking…' : '✨ Show me why today matters'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Today's Priorities */}
                <div className="section fade-in stagger-5">
                    <div className="section-title">Today's Priorities</div>
                    <div className="card">
                        <div className="card-body no-pad">
                            {data.todayTasks.length === 0 ? (
                                <div className="empty-state">No tasks for today. Time for deep work.</div>
                            ) : (
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Task</th>
                                                <th>Priority</th>
                                                <th>Due</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.todayTasks.map(t => (
                                                <tr key={t.id}>
                                                    <td className="title-col">
                                                        <a href={t.url} target="_blank" rel="noreferrer">{t.title}</a>
                                                    </td>
                                                    <td><span className={`badge ${priorityClass(t.priority)}`}>{t.priority || '—'}</span></td>
                                                    <td>{t.dueDate || t.scheduledDate || '—'}</td>
                                                    <td>{t.status || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Overdue */}
                {data.overdueTasks.length > 0 && (
                    <div className="section fade-in stagger-4">
                        <div className="section-title">⚠ Overdue</div>
                        <div className="card">
                            <div className="card-body no-pad">
                                <div className="issue-list">
                                    {data.overdueTasks.map(t => (
                                        <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="issue-item">
                                            <span className="issue-dot red" />
                                            <span style={{ flex: 1 }}>{t.title}</span>
                                            <span style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.dueDate}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
