/**
 * Strategy Analysis Module
 * The "Project Manager" brain that analyzes high-level progress and health.
 */
import { getProvider, Task, Project, Goal } from '../providers';

export interface GoalProgress {
    id: string;
    title: string;
    url: string;
    percent: number;
    total: number;
    completed: number;
}

export interface StrategyMetrics {
    activeGoalsCount: number;
    activeProjectsCount: number;
    activeTasksCount: number;
    focusScore: number;
}

export interface StrategyIssues {
    stalledGoals: Goal[];
    zombieProjects: Project[];
    isOverloaded: boolean;
}

export interface StrategyAnalysis {
    metrics: StrategyMetrics;
    issues: StrategyIssues;
    progress: GoalProgress[];
}

/**
 * Run comprehensive strategy analysis
 */
export async function runStrategyAnalysis(): Promise<StrategyAnalysis> {
    const provider = getProvider();
    const [tasks, projects, goals] = await Promise.all([
        provider.fetchTasks(),
        provider.fetchProjects(),
        provider.fetchGoals(),
    ]);

    const activeProjects = projects.filter(p => p.active);
    const activeGoals = goals.filter(g => !g.completed);
    const activeTasks = tasks.filter(t => !t.completed);

    // Stalled Goals: no active project linked to this goal
    const stalledGoals = activeGoals.filter(goal => {
        return !activeProjects.some(p => p.goalIds.includes(goal.id));
    });

    // Zombie Projects: active but no active tasks
    const zombieProjects = activeProjects.filter(project => {
        return !activeTasks.some(t => t.projectId === project.id);
    });

    const FOCUS_THRESHOLD = 5;
    const isOverloaded = activeProjects.length > FOCUS_THRESHOLD;
    const focusScore = Math.max(0, 100 - (activeProjects.length * 10));

    // Goal progress: % of linked projects completed
    const goalProgress: GoalProgress[] = activeGoals.map(goal => {
        const linked = projects.filter(p => p.goalIds.includes(goal.id));
        const total = linked.length;
        if (total === 0) return { id: goal.id, title: goal.title, url: goal.url, percent: 0, total: 0, completed: 0 };
        const completed = linked.filter(p => p.statusCategory === 'DONE').length;
        return {
            id: goal.id,
            title: goal.title,
            url: goal.url,
            percent: Math.round((completed / total) * 100),
            total,
            completed,
        };
    });

    return {
        metrics: {
            activeGoalsCount: activeGoals.length,
            activeProjectsCount: activeProjects.length,
            activeTasksCount: activeTasks.length,
            focusScore,
        },
        issues: { stalledGoals, zombieProjects, isOverloaded },
        progress: goalProgress,
    };
}

/**
 * Format the strategy report
 */
export function formatStrategyReport(analysis: StrategyAnalysis): string {
    const { metrics, issues, progress } = analysis;
    const lines: string[] = [];

    const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    lines.push('<b>🧠 Tactical Strategy Report</b>');
    lines.push(`Focus Score: ${metrics.focusScore}/100`);
    lines.push('──────────────────────────');

    if (issues.isOverloaded) {
        lines.push(`⚠️ <b>FOCUS ALERT</b>: You have ${metrics.activeProjectsCount} active projects.`);
        lines.push(`   Suggested limit is 5. Consider pausing ${metrics.activeProjectsCount - 5}.`);
        lines.push('');
    } else {
        lines.push(`✅ Focus looks good (${metrics.activeProjectsCount} active projects).`);
        lines.push('');
    }

    if (issues.stalledGoals.length > 0) {
        lines.push(`🚫 <b>Stalled Goals</b> (No active projects):`);
        issues.stalledGoals.forEach(g => lines.push(`   • <a href="${g.url}">${escapeHtml(g.title)}</a>`));
        lines.push(`   <i>Action: Archive goal or start a project.</i>`);
        lines.push('');
    }

    if (issues.zombieProjects.length > 0) {
        lines.push(`🧟 <b>Zombie Projects</b> (Active but no tasks):`);
        issues.zombieProjects.slice(0, 5).forEach(p => lines.push(`   • <a href="${p.url}">${escapeHtml(p.title)}</a>`));
        if (issues.zombieProjects.length > 5) lines.push(`   ...and ${issues.zombieProjects.length - 5} more`);
        lines.push(`   <i>Action: Plan tasks or move project to "On Hold".</i>`);
        lines.push('');
    }

    lines.push(`📊 <b>Goal Progress</b>:`);
    progress.sort((a, b) => b.percent - a.percent).forEach(g => {
        const bars = Math.round(g.percent / 10);
        const barStr = '▓'.repeat(bars) + '░'.repeat(10 - bars);
        lines.push(`   ${barStr} ${g.percent}% | <a href="${g.url}">${escapeHtml(g.title)}</a>`);
    });

    return lines.join('\n');
}
