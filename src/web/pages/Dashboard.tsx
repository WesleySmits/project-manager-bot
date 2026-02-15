import React, { useEffect, useState } from 'react';
import { api, DashboardData } from '../client';

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

    useEffect(() => {
        api.dashboard().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
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

                {/* AI Motivation */}
                <div className="section fade-in stagger-2">
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
                <div className="section fade-in stagger-3">
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
