import React, { useEffect, useState } from 'react';
import { api, HealthData, TaskItem, ProjectItem } from '../client';

function IssueSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
    const [open, setOpen] = useState(count > 0);
    return (
        <div className="section fade-in" style={{ marginBottom: 16 }}>
            <div
                className="section-title"
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => setOpen(!open)}
            >
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{open ? '▼' : '▶'}</span>
                {title}
                <span className={`badge ${count > 0 ? 'high' : 'low'}`} style={{ marginLeft: 4 }}>{count}</span>
            </div>
            {open && count > 0 && (
                <div className="card">
                    <div className="card-body no-pad">
                        <div className="issue-list">{children}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TaskIssueItem({ task }: { task: TaskItem }) {
    return (
        <a href={task.url} target="_blank" rel="noreferrer" className="issue-item" style={{ textDecoration: 'none' }}>
            <span className="issue-dot red" />
            <span style={{ flex: 1 }}>{task.title || 'Untitled'}</span>
            {task.status && <span className="badge low" style={{ marginLeft: 4 }}>{task.status}</span>}
            {task.dueDate && <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12, marginLeft: 8 }}>{task.dueDate}</span>}
        </a>
    );
}

function ProjectIssueItem({ project }: { project: ProjectItem }) {
    return (
        <a href={project.url} target="_blank" rel="noreferrer" className="issue-item" style={{ textDecoration: 'none' }}>
            <span className="issue-dot" style={{ background: 'var(--accent)' }} />
            <span style={{ flex: 1 }}>{project.title || 'Untitled'}</span>
            {project.status && <span className="badge low" style={{ marginLeft: 4 }}>{project.status}</span>}
        </a>
    );
}

export default function Health() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.health().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-state"><span className="spinner" /> Loading health data…</div>;
    if (!data) return <div className="empty-state">Failed to load health data.</div>;

    const issues = data.issues;
    const totalIssues =
        issues.orphanedTasks.length +
        issues.projectsWithoutGoal.length +
        issues.overdueDueDate.length +
        issues.overdueScheduled.length +
        issues.missingRequiredFields.length +
        issues.missingDescription.length +
        issues.projectsMissingDescription.length;

    return (
        <>
            <header className="page-header"><h1>Health</h1></header>
            <div className="page-body">

                {/* Summary metrics */}
                <div className="metrics-grid fade-in">
                    <div className="metric-card">
                        <div className="metric-label">Total Issues</div>
                        <div className={`metric-value ${totalIssues > 0 ? 'red' : 'green'}`}>{totalIssues}</div>
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

                {/* Issue categories — each collapsible with clickable items */}
                <IssueSection title="Overdue (by due date)" count={issues.overdueDueDate.length}>
                    {issues.overdueDueDate.map(t => <TaskIssueItem key={t.id} task={t} />)}
                </IssueSection>

                <IssueSection title="Overdue (by scheduled date)" count={issues.overdueScheduled.length}>
                    {issues.overdueScheduled.map(t => <TaskIssueItem key={t.id} task={t} />)}
                </IssueSection>

                <IssueSection title="Tasks without description" count={issues.missingDescription.length}>
                    {issues.missingDescription.map(t => <TaskIssueItem key={t.id} task={t} />)}
                </IssueSection>

                <IssueSection title="Projects without description" count={issues.projectsMissingDescription.length}>
                    {issues.projectsMissingDescription.map(p => <ProjectIssueItem key={p.id} project={p} />)}
                </IssueSection>

                <IssueSection title="Orphaned tasks (no project)" count={issues.orphanedTasks.length}>
                    {issues.orphanedTasks.map(t => <TaskIssueItem key={t.id} task={t} />)}
                </IssueSection>

                <IssueSection title="Projects without goal" count={issues.projectsWithoutGoal.length}>
                    {issues.projectsWithoutGoal.map(p => <ProjectIssueItem key={p.id} project={p} />)}
                </IssueSection>

                <IssueSection title="Tasks missing required fields" count={issues.missingRequiredFields.length}>
                    {issues.missingRequiredFields.map(t => <TaskIssueItem key={t.id} task={t} />)}
                </IssueSection>
            </div>
        </>
    );
}
