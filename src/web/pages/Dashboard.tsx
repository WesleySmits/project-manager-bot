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

    useEffect(() => {
        api.dashboard().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state"><span className="spinner" /> Loading dashboard…</div>;
    if (!data) return <div className="empty-state">Failed to load dashboard.</div>;

    const m = data.metrics;

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

                {/* Today's Priorities */}
                <div className="section fade-in stagger-1">
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
                    <div className="section fade-in stagger-2">
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
