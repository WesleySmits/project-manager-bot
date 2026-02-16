import React, { useEffect, useState } from 'react';
import { api, ProjectItem } from '../client';

function statusBadge(cat: string, blocked: boolean) {
    if (blocked) return <span className="badge status-blocked">Blocked</span>;
    switch (cat) {
        case 'ACTIVE': return <span className="badge status-active">Active</span>;
        case 'DONE': return <span className="badge status-done">Done</span>;
        case 'PARKED': return <span className="badge status-parked">Parked</span>;
        default: return <span className="badge none">{cat}</span>;
    }
}

export default function Projects() {
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.projects().then(p => { setProjects(p); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state"><span className="spinner" /> Loading projects…</div>;

    // Group by status category (excluding evergreen)
    const active = projects.filter(p => p.statusCategory === 'ACTIVE' && !p.evergreen);
    const ready = projects.filter(p => p.statusCategory === 'READY' && !p.evergreen);
    const backlog = projects.filter(p => p.statusCategory === 'BACKLOG' && !p.evergreen);
    const parked = projects.filter(p => p.statusCategory === 'PARKED' && !p.evergreen);
    const done = projects.filter(p => p.statusCategory === 'DONE' && !p.evergreen);

    // Evergreen bucket
    const evergreen = projects.filter(p => p.evergreen);

    const sections = [
        { label: 'In Progress', items: active },
        { label: 'Ready', items: ready },
        { label: 'Backlog', items: backlog },
        { label: 'Parked', items: parked },
        { label: 'Completed', items: done },
        { label: 'Evergreen 🌿', items: evergreen },
    ].filter(s => s.items.length > 0);

    return (
        <>
            <header className="page-header"><h1>Projects</h1></header>
            <div className="page-body">
                {sections.map((section, si) => (
                    <div key={section.label} className={`section fade-in stagger-${si + 1}`}>
                        <div className="section-title">{section.label} · {section.items.length}</div>
                        <div className="card">
                            <div className="card-body no-pad">
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Project</th>
                                                <th>Status</th>
                                                <th>Tasks</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {section.items.map(p => (
                                                <tr key={p.id}>
                                                    <td className="title-col">
                                                        <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                                                    </td>
                                                    <td>{statusBadge(p.statusCategory, p.blocked)}</td>
                                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.taskCount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
