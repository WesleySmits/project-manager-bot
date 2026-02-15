import React, { useEffect, useState } from 'react';
import { api, TaskItem } from '../client';

function priorityClass(p: string | null): string {
    if (!p) return 'none';
    const l = p.toLowerCase();
    if (l.includes('high') || l.includes('p1') || l.includes('urgent')) return 'high';
    if (l.includes('medium') || l.includes('p2')) return 'medium';
    return 'low';
}

type Filter = 'all' | 'active' | 'completed';

export default function Tasks() {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('active');

    useEffect(() => {
        api.tasks().then(t => { setTasks(t); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state"><span className="spinner" /> Loading tasks…</div>;

    const filtered = tasks.filter(t => {
        if (filter === 'active') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
    });

    return (
        <>
            <header className="page-header">
                <h1>Tasks</h1>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {(['all', 'active', 'completed'] as Filter[]).map(f => (
                        <button
                            key={f}
                            className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setFilter(f)}
                            style={{ textTransform: 'capitalize', fontSize: 12 }}
                        >{f}</button>
                    ))}
                </div>
            </header>
            <div className="page-body">
                <div className="card fade-in">
                    <div className="card-body no-pad">
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Task</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Due</th>
                                        <th>Project</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={5} className="empty-state">No tasks found.</td></tr>
                                    ) : filtered.map(t => (
                                        <tr key={t.id}>
                                            <td className="title-col">
                                                <a href={t.url} target="_blank" rel="noreferrer">{t.title}</a>
                                            </td>
                                            <td><span className={`badge ${priorityClass(t.priority)}`}>{t.priority || '—'}</span></td>
                                            <td>{t.status || '—'}</td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.dueDate || t.scheduledDate || '—'}</td>
                                            <td>{t.hasProject ? '✓' : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Showing {filtered.length} of {tasks.length} tasks
                </div>
            </div>
        </>
    );
}
