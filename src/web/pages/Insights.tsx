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
    const sortedProgress = [...progress].sort((a, b) => b.percent - a.percent);
    const topGoals = sortedProgress.slice(0, 3);
    const laggingGoals = sortedProgress.filter(g => g.percent < 50).sort((a, b) => a.percent - b.percent);

    // Build actionable steps
    const actionSteps: Array<{ emoji: string; text: string; type: 'critical' | 'warning' | 'info' }> = [];

    if (issues.isOverloaded) {
        const toPause = metrics.activeProjectsCount - 5;
        actionSteps.push({
            emoji: '🔴',
            text: `Pause ${toPause} project${toPause > 1 ? 's' : ''}. You have ${metrics.activeProjectsCount} active — max recommended is 5. Pick the ${toPause} with lowest goal impact and move to Backlog.`,
            type: 'critical',
        });
    }

    for (const goal of issues.stalledGoals) {
        actionSteps.push({
            emoji: '🟡',
            text: `"${goal.title}" has no active projects. Create or attach a project to avoid losing momentum.`,
            type: 'warning',
        });
    }

    for (const proj of issues.zombieProjects) {
        actionSteps.push({
            emoji: '🧟',
            text: `"${proj.title}" is active but has no tasks. Either add tasks or archive it — it's consuming your mental bandwidth.`,
            type: 'warning',
        });
    }

    if (laggingGoals.length > 0 && actionSteps.length < 8) {
        const worst = laggingGoals[0];
        actionSteps.push({
            emoji: '📉',
            text: `"${worst.title}" is your lowest-progress goal at ${worst.percent}%. Consider scheduling tasks for its projects this week.`,
            type: 'info',
        });
    }

    if (actionSteps.length === 0) {
        actionSteps.push({
            emoji: '✅',
            text: 'No critical issues. Your system is well-organized. Keep executing on your current priorities.',
            type: 'info',
        });
    }

    return (
        <>
            <header className="page-header"><h1>Strategic Insights</h1></header>
            <div className="page-body">

                {/* Focus Score (prominent) */}
                <div className="metrics-grid fade-in">
                    <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                        <div className="metric-label">Focus Score</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <div className={`metric-value ${metrics.focusScore >= 60 ? 'green' : metrics.focusScore >= 30 ? 'orange' : 'red'}`}>
                                {metrics.focusScore}
                            </div>
                            <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>/100</span>
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                                {metrics.focusScore >= 60 ? 'Great focus' : metrics.focusScore >= 30 ? 'Spread thin' : 'Overloaded — action needed'}
                            </span>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active Projects</div>
                        <div className="metric-value accent">{metrics.activeProjectsCount}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active Goals</div>
                        <div className="metric-value">{metrics.activeGoalsCount}</div>
                    </div>
                </div>

                {/* Action Steps — the core of this page */}
                <div className="section fade-in stagger-1">
                    <div className="section-title">🎯 How to Improve Your Score</div>
                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}>
                            {actionSteps.map((step, i) => (
                                <div key={i} style={{
                                    padding: '14px 20px',
                                    borderBottom: i < actionSteps.length - 1 ? '1px solid var(--border)' : 'none',
                                    display: 'flex',
                                    gap: 12,
                                    alignItems: 'flex-start',
                                }}>
                                    <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{step.emoji}</span>
                                    <div>
                                        <div style={{
                                            fontSize: 10,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            marginBottom: 4,
                                            color: step.type === 'critical' ? 'var(--red)' : step.type === 'warning' ? 'var(--orange)' : 'var(--text-tertiary)',
                                        }}>
                                            {step.type === 'critical' ? 'Critical' : step.type === 'warning' ? 'Recommended' : 'Suggestion'}
                                        </div>
                                        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{step.text}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="two-col">
                    {/* Top Goals to Focus On */}
                    <div className="section fade-in stagger-2">
                        <div className="section-title">🏆 Priority Goals</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {topGoals.map((g, i) => (
                                <a key={g.id} href={g.url} target="_blank" rel="noreferrer" className="goal-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span className="goal-title" style={{ marginBottom: 0, fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>#{i + 1}</span>
                                            {g.title}
                                        </span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{g.percent}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${g.percent}%` }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                        {g.completed}/{g.total} projects completed
                                        {g.percent >= 80 && ' — almost there!'}
                                        {g.percent === 0 && ' — needs attention'}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* All Goal Progress */}
                    <div className="section fade-in stagger-3">
                        <div className="section-title">📊 All Goal Progress</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {sortedProgress.map(g => (
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
                <div className="section fade-in stagger-4">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        ✦ Deep Analysis (AI)
                        <button className="btn btn-primary" onClick={handleGenerateInsight} disabled={loadingAI}>
                            {loadingAI ? 'Thinking…' : 'Generate Deep Analysis'}
                        </button>
                    </div>
                    {aiInsight && (
                        <div className="insight-panel">
                            <div className="insight-text"
                                dangerouslySetInnerHTML={{ __html: aiInsight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    )}
                    {!aiInsight && !loadingAI && (
                        <div className="card">
                            <div className="card-body empty-state">
                                Click to get a detailed AI analysis of your strategic position and personalized recommendations.
                            </div>
                        </div>
                    )}
                    {loadingAI && (
                        <div className="card">
                            <div className="loading-state"><span className="spinner" /> Analyzing your strategy…</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
