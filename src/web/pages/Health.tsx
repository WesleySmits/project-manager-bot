import React, { useEffect, useState } from 'react';
import { api, HealthData } from '../client';

export default function Health() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.health().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state"><span className="spinner" /> Running health check…</div>;
    if (!data) return <div className="empty-state">Failed to load health data.</div>;

    const { totals, issues } = data;

    const totalIssues =
        issues.orphanedTasks.length +
        issues.projectsWithoutGoal.length +
        issues.overdueDueDate.length +
        issues.overdueScheduled.length +
        issues.missingRequiredFields.length;

    return (
        <>
            <header className="page-header"><h1>Health & Diagnostics</h1></header>
            <div className="page-body">

                {/* Summary */}
                <div className="metrics-grid fade-in">
                    <div className="metric-card">
                        <div className="metric-label">Total Issues</div>
                        <div className={`metric-value ${totalIssues > 0 ? 'red' : 'green'}`}>{totalIssues}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Tasks</div>
                        <div className="metric-value">{totals.activeTasks}<span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>/{totals.tasks}</span></div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Projects</div>
                        <div className="metric-value">{totals.projects}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Goals</div>
                        <div className="metric-value">{totals.goals}</div>
                    </div>
                </div>

                {/* Issues */}
                <div className="two-col">
                    {/* Orphaned Tasks */}
                    <div className="section fade-in stagger-1">
                        <div className="section-title">Orphaned Tasks · {issues.orphanedTasks.length}</div>
                        <div className="card">
                            <div className="card-body no-pad">
                                {issues.orphanedTasks.length === 0 ? (
                                    <div className="empty-state">No orphaned tasks ✓</div>
                                ) : (
                                    <div className="issue-list">
                                        {issues.orphanedTasks.slice(0, 15).map(t => (
                                            <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="issue-item">
                                                <span className="issue-dot orange" />
                                                {t.title}
                                            </a>
                                        ))}
                                        {issues.orphanedTasks.length > 15 && (
                                            <div className="issue-item" style={{ color: 'var(--text-tertiary)' }}>
                                                +{issues.orphanedTasks.length - 15} more
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Projects without Goal */}
                    <div className="section fade-in stagger-2">
                        <div className="section-title">Projects without Goal · {issues.projectsWithoutGoal.length}</div>
                        <div className="card">
                            <div className="card-body no-pad">
                                {issues.projectsWithoutGoal.length === 0 ? (
                                    <div className="empty-state">All projects linked ✓</div>
                                ) : (
                                    <div className="issue-list">
                                        {issues.projectsWithoutGoal.map(p => (
                                            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="issue-item">
                                                <span className="issue-dot yellow" />
                                                {p.title}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Overdue */}
                    <div className="section fade-in stagger-3">
                        <div className="section-title">Overdue (Due Date) · {issues.overdueDueDate.length}</div>
                        <div className="card">
                            <div className="card-body no-pad">
                                {issues.overdueDueDate.length === 0 ? (
                                    <div className="empty-state">Nothing overdue ✓</div>
                                ) : (
                                    <div className="issue-list">
                                        {issues.overdueDueDate.slice(0, 10).map(t => (
                                            <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="issue-item">
                                                <span className="issue-dot red" />
                                                <span style={{ flex: 1 }}>{t.title}</span>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--red)' }}>{t.dueDate}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Missing Fields */}
                    <div className="section fade-in stagger-4">
                        <div className="section-title">Missing Required Fields · {issues.missingRequiredFields.length}</div>
                        <div className="card">
                            <div className="card-body no-pad">
                                {issues.missingRequiredFields.length === 0 ? (
                                    <div className="empty-state">All fields complete ✓</div>
                                ) : (
                                    <div className="issue-list">
                                        {issues.missingRequiredFields.slice(0, 10).map(t => (
                                            <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="issue-item">
                                                <span className="issue-dot yellow" />
                                                {t.title}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Description coverage */}
                <div className="section fade-in stagger-5">
                    <div className="section-title">Description Coverage</div>
                    <div className="card">
                        <div className="card-body" style={{ display: 'flex', gap: 32 }}>
                            <div>
                                <div className="metric-label">Tasks Missing Description</div>
                                <div className="metric-value orange" style={{ fontSize: 20 }}>{issues.missingDescription}</div>
                            </div>
                            <div>
                                <div className="metric-label">Projects Missing Description</div>
                                <div className="metric-value orange" style={{ fontSize: 20 }}>{issues.projectsMissingDescription}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
