import React, { useEffect, useState } from 'react';
import { api, StrategyData } from '../client';

export default function Insights() {
    const [strategy, setStrategy] = useState<StrategyData | null>(null);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [loadingStrategy, setLoadingStrategy] = useState(true);
    const [loadingAI, setLoadingAI] = useState(false);

    useEffect(() => {
        api.strategy().then(s => { setStrategy(s); setLoadingStrategy(false); }).catch(() => setLoadingStrategy(false));
    }, []);

    const handleGenerateInsight = () => {
        setLoadingAI(true);
        setAiInsight(null);
        api.aiInsight().then(r => { setAiInsight(r.insight); setLoadingAI(false); }).catch(() => { setAiInsight('Failed to generate insight.'); setLoadingAI(false); });
    };

    if (loadingStrategy) return <div className="loading-state"><span className="spinner" /> Analyzing strategy…</div>;
    if (!strategy) return <div className="empty-state">Failed to load strategy data.</div>;

    const { metrics, issues, progress } = strategy;

    return (
        <>
            <header className="page-header"><h1>Strategic Insights</h1></header>
            <div className="page-body">

                {/* Focus Score */}
                <div className="metrics-grid fade-in">
                    <div className="metric-card">
                        <div className="metric-label">Focus Score</div>
                        <div className={`metric-value ${metrics.focusScore >= 60 ? 'green' : metrics.focusScore >= 30 ? 'orange' : 'red'}`}>
                            {metrics.focusScore}<span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>/100</span>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active Goals</div>
                        <div className="metric-value">{metrics.activeGoalsCount}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active Projects</div>
                        <div className="metric-value accent">{metrics.activeProjectsCount}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active Tasks</div>
                        <div className="metric-value">{metrics.activeTasksCount}</div>
                    </div>
                </div>

                <div className="two-col">
                    {/* Issues */}
                    <div className="section fade-in stagger-1">
                        <div className="section-title">Issues Detected</div>

                        {issues.isOverloaded && (
                            <div className="card" style={{ marginBottom: 12, borderColor: 'var(--red)', borderWidth: 1 }}>
                                <div className="card-body" style={{ color: 'var(--red)', fontSize: 13 }}>
                                    ⚠ <strong>Focus Alert:</strong> {metrics.activeProjectsCount} active projects. Consider pausing {metrics.activeProjectsCount - 5}.
                                </div>
                            </div>
                        )}

                        {issues.stalledGoals.length > 0 && (
                            <div className="card" style={{ marginBottom: 12 }}>
                                <div className="card-header"><h2>Stalled Goals</h2></div>
                                <div className="card-body no-pad">
                                    <div className="issue-list">
                                        {issues.stalledGoals.map(g => (
                                            <a key={g.id} href={g.url} target="_blank" rel="noreferrer" className="issue-item">
                                                <span className="issue-dot red" />
                                                {g.title}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {issues.zombieProjects.length > 0 && (
                            <div className="card">
                                <div className="card-header"><h2>Zombie Projects</h2></div>
                                <div className="card-body no-pad">
                                    <div className="issue-list">
                                        {issues.zombieProjects.map(p => (
                                            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="issue-item">
                                                <span className="issue-dot orange" />
                                                {p.title}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!issues.isOverloaded && issues.stalledGoals.length === 0 && issues.zombieProjects.length === 0 && (
                            <div className="card">
                                <div className="card-body empty-state">No strategic issues detected ✓</div>
                            </div>
                        )}
                    </div>

                    {/* Goal Progress */}
                    <div className="section fade-in stagger-2">
                        <div className="section-title">Goal Progress</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {progress.sort((a, b) => b.percent - a.percent).map(g => (
                                <a key={g.id} href={g.url} target="_blank" rel="noreferrer" className="goal-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span className="goal-title" style={{ marginBottom: 0, fontSize: 13 }}>{g.title}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{g.percent}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${g.percent}%` }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                        {g.completed}/{g.total} projects completed
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI Oracle */}
                <div className="section fade-in stagger-3">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        ✦ Oracle (AI)
                        <button className="btn btn-primary" onClick={handleGenerateInsight} disabled={loadingAI}>
                            {loadingAI ? 'Thinking…' : 'Generate Insight'}
                        </button>
                    </div>
                    {aiInsight && (
                        <div className="insight-panel">
                            <div className="insight-text">{aiInsight}</div>
                        </div>
                    )}
                    {!aiInsight && !loadingAI && (
                        <div className="card">
                            <div className="card-body empty-state">
                                Click "Generate Insight" to get AI-powered strategic advice.
                            </div>
                        </div>
                    )}
                    {loadingAI && (
                        <div className="card">
                            <div className="loading-state"><span className="spinner" /> Consulting the Oracle…</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
