"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStrategyAnalysis = runStrategyAnalysis;
exports.formatStrategyReport = formatStrategyReport;
/**
 * Strategy Analysis Module
 * The "Project Manager" brain that analyzes high-level progress and health.
 */
const client_1 = require("../notion/client");
/**
 * Run comprehensive strategy analysis
 */
async function runStrategyAnalysis() {
    const [tasks, projects, goals] = await Promise.all([
        (0, client_1.fetchTasks)(),
        (0, client_1.fetchProjects)(),
        (0, client_1.fetchGoals)()
    ]);
    // Use centralized status logic: only "In Progress" + not blocked
    const activeProjects = projects.filter(client_1.isActiveProject);
    const activeGoals = goals.filter(g => !(0, client_1.isCompleted)(g));
    const activeTasks = tasks.filter(t => !(0, client_1.isCompleted)(t));
    // --- Insight 1: Goal Health (Stalled Goals) ---
    // A Goal is stalled if it has no Active Projects linked to it.
    const stalledGoals = activeGoals.filter(goal => {
        // Find projects linked to this goal
        // Note: Relations are two-way, so we can look at Goal's relation property or Project's relation property.
        // Assuming 'Projects' relation on Goal db or 'Goal' relation on Project db.
        // Check if any active project points to this goal
        const hasLinkedProject = activeProjects.some(project => {
            const linkedGoalIds = (0, client_1.getRelationIds)(project, 'Goal') || (0, client_1.getRelationIds)(project, 'Goals');
            return linkedGoalIds.includes(goal.id);
        });
        return !hasLinkedProject;
    });
    // --- Insight 2: Project Health (Zombie Projects) ---
    // A Project is a "Zombie" if it is Active but has NO active tasks linked.
    const zombieProjects = activeProjects.filter(project => {
        const hasActiveTasks = activeTasks.some(task => {
            const linkedProjectIds = (0, client_1.getRelationIds)(task, 'Project') || (0, client_1.getRelationIds)(task, 'Projects');
            return linkedProjectIds.includes(project.id);
        });
        return !hasActiveTasks;
    });
    // --- Insight 3: Workload / Focus Check ---
    // Too many active projects = lack of focus.
    const FOCUS_THRESHOLD = 5;
    const isOverloaded = activeProjects.length > FOCUS_THRESHOLD;
    const focusScore = Math.max(0, 100 - (activeProjects.length * 10)); // Rough heuristic
    // --- Insight 4: Progress (Ship Rate) ---
    // Calculate % of projects completed for each goal
    const goalProgress = activeGoals.map(goal => {
        // Find all projects (active + completed) for this goal
        const linkedProjects = projects.filter(p => {
            const linkedGoalIds = (0, client_1.getRelationIds)(p, 'Goal') || (0, client_1.getRelationIds)(p, 'Goals');
            return linkedGoalIds.includes(goal.id);
        });
        const total = linkedProjects.length;
        if (total === 0)
            return { id: goal.id, title: (0, client_1.getTitle)(goal), url: goal.url, percent: 0, total: 0, completed: 0 };
        const completed = linkedProjects.filter(p => (0, client_1.isCompleted)(p)).length;
        return {
            id: goal.id,
            title: (0, client_1.getTitle)(goal),
            url: goal.url,
            percent: Math.round((completed / total) * 100),
            total,
            completed
        };
    });
    return {
        metrics: {
            activeGoalsCount: activeGoals.length,
            activeProjectsCount: activeProjects.length,
            activeTasksCount: activeTasks.length,
            focusScore
        },
        issues: {
            stalledGoals, // Goals with no projects
            zombieProjects, // Projects with no tasks
            isOverloaded // Too many active projects
        },
        progress: goalProgress
    };
}
/**
 * Format the strategy report
 */
function formatStrategyReport(analysis) {
    const { metrics, issues, progress } = analysis;
    const lines = [];
    lines.push('<b>🧠 Tactical Strategy Report</b>');
    lines.push(`Focus Score: ${metrics.focusScore}/100`);
    lines.push('──────────────────────────');
    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // 1. Focus Warning
    if (issues.isOverloaded) {
        lines.push(`⚠️ <b>FOCUS ALERT</b>: You have ${metrics.activeProjectsCount} active projects.`);
        lines.push(`   Suggested limit is 5. Consider pausing ${metrics.activeProjectsCount - 5}.`);
        lines.push('');
    }
    else {
        lines.push(`✅ Focus looks good (${metrics.activeProjectsCount} active projects).`);
        lines.push('');
    }
    // 2. Stalled Goals
    if (issues.stalledGoals.length > 0) {
        lines.push(`🚫 <b>Stalled Goals</b> (No active projects):`);
        issues.stalledGoals.forEach(g => lines.push(`   • <a href="${g.url}">${escapeHtml((0, client_1.getTitle)(g))}</a>`));
        lines.push(`   <i>Action: Archive goal or start a project.</i>`);
        lines.push('');
    }
    // 3. Zombie Projects
    if (issues.zombieProjects.length > 0) {
        lines.push(`🧟 <b>Zombie Projects</b> (Active but no tasks):`);
        issues.zombieProjects.slice(0, 5).forEach(p => lines.push(`   • <a href="${p.url}">${escapeHtml((0, client_1.getTitle)(p))}</a>`));
        if (issues.zombieProjects.length > 5)
            lines.push(`   ...and ${issues.zombieProjects.length - 5} more`);
        lines.push(`   <i>Action: Plan tasks or move project to "On Hold".</i>`);
        lines.push('');
    }
    // 4. Goal Progress
    lines.push(`📊 <b>Goal Progress</b>:`);
    progress.sort((a, b) => b.percent - a.percent).forEach(g => {
        // Progress bar
        const bars = Math.round(g.percent / 10);
        const empty = 10 - bars;
        const barStr = '▓'.repeat(bars) + '░'.repeat(empty);
        lines.push(`   ${barStr} ${g.percent}% | <a href="${g.url}">${escapeHtml(g.title)}</a>`);
    });
    return lines.join('\n');
}
