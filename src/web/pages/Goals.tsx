import React, { useEffect, useState } from 'react';
import { api, GoalItem } from '../client';

export default function Goals() {
    const [goals, setGoals] = useState<GoalItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.goals().then(g => { setGoals(g); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state"><span className="spinner" /> Loading goals…</div>;
    if (goals.length === 0) return <div className="empty-state">No active goals found.</div>;

    return (
        <>
            <header className="page-header"><h1>Goals</h1></header>
            <div className="page-body">
                <div className="three-col">
                    {goals.map((g, i) => (
                        <a
                            key={g.id}
                            href={g.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`goal-card fade-in stagger-${Math.min(i + 1, 5)}`}
                        >
                            <div className="goal-title">{g.title}</div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${g.progress}%` }} />
                            </div>
                            <div className="goal-meta">
                                <span>{g.progress}%</span>
                                <span>{g.completedProjects}/{g.projectCount} projects</span>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
}
