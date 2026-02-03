/**
 * Notion Health Check Module
 * Analyzes Goals → Projects → Tasks hierarchy for issues
 */
const dayjs = require('dayjs');
const {
    fetchTasks, fetchProjects, fetchGoals,
    getTitle, getDescription, hasRelation, isCompleted, getDate
} = require('./client');

/**
 * Run comprehensive health check on Notion workspace
 * @returns {Object} Health report with issues
 */
async function runHealthCheck() {
    // console.log('Querying Notion databases...');

    const [tasks, projects, goals] = await Promise.all([
        fetchTasks(),
        fetchProjects(),
        fetchGoals()
    ]);

    // console.log(`Fetched: ${tasks.length} tasks, ${projects.length} projects, ${goals.length} goals`);

    const activeTasks = tasks.filter(t => !isCompleted(t));
    const today = dayjs();

    // 1. Orphaned tasks (no Project relation)
    const orphanedTasks = activeTasks.filter(t => !hasRelation(t));

    // 2. Projects without Goal relation
    const projectsWithoutGoal = projects.filter(p => !hasRelation(p));

    // 3. Tasks with overdue DUE DATE
    const overdueDueDate = activeTasks.filter(t => {
        const due = getDate(t, 'Due Date') || getDate(t, 'Due');
        return due && dayjs(due).isBefore(today, 'day');
    });

    // 4. Tasks with overdue SCHEDULED DATE (new check)
    const overdueScheduled = activeTasks.filter(t => {
        const scheduled = getDate(t, 'Scheduled');
        return scheduled && dayjs(scheduled).isBefore(today, 'day');
    });

    // 5. Tasks missing required fields (title, status, priority)
    const missingRequiredFields = activeTasks.filter(t => {
        const title = getTitle(t);
        const priority = t.properties?.Priority?.select?.name;
        const status = t.properties?.Status?.status?.name;
        return !title || title === 'Untitled' || !priority || !status;
    });

    // 6. Tasks missing description (new check)
    const missingDescription = activeTasks.filter(t => !getDescription(t));

    // 7. Projects missing description
    const projectsMissingDescription = projects.filter(p => !getDescription(p));

    return {
        totals: {
            tasks: tasks.length,
            activeTasks: activeTasks.length,
            projects: projects.length,
            goals: goals.length
        },
        issues: {
            orphanedTasks,
            projectsWithoutGoal,
            overdueDueDate,
            overdueScheduled,
            missingRequiredFields,
            missingDescription,
            projectsMissingDescription
        }
    };
}

/**
 * Format health report as text
 */
function formatHealthReport(report) {
    const lines = [];
    const { totals, issues } = report;

    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    lines.push('📊 <b>Notion Health Report</b>');
    lines.push('─────────────────────');
    lines.push(`Tasks: ${totals.activeTasks} active / ${totals.tasks} total`);
    lines.push(`Projects: ${totals.projects}`);
    lines.push(`Goals: ${totals.goals}`);
    lines.push('');

    // Orphaned tasks
    lines.push(`⚠️ <b>Orphaned tasks</b> (no project): ${issues.orphanedTasks.length}`);
    issues.orphanedTasks.forEach(t => {
        lines.push(`  • <a href="${t.url}">${escapeHtml(getTitle(t))}</a>`);
    });
    lines.push('');

    // Projects without goal
    lines.push(`⚠️ <b>Projects without goal</b>: ${issues.projectsWithoutGoal.length}`);
    issues.projectsWithoutGoal.forEach(p => {
        lines.push(`  • <a href="${p.url}">${escapeHtml(getTitle(p))}</a>`);
    });
    lines.push('');

    // Overdue due dates
    lines.push(`🔴 <b>Overdue (due date passed)</b>: ${issues.overdueDueDate.length}`);
    issues.overdueDueDate.forEach(t => {
        const due = getDate(t, 'Due Date') || getDate(t, 'Due');
        lines.push(`  • <a href="${t.url}">${escapeHtml(getTitle(t))}</a> — due ${dayjs(due).format('D MMM')}`);
    });
    lines.push('');

    // Overdue scheduled dates
    lines.push(`🟠 <b>Overdue (scheduled date passed)</b>: ${issues.overdueScheduled.length}`);
    issues.overdueScheduled.forEach(t => {
        const scheduled = getDate(t, 'Scheduled');
        lines.push(`  • <a href="${t.url}">${escapeHtml(getTitle(t))}</a> — scheduled ${dayjs(scheduled).format('D MMM')}`);
    });
    lines.push('');

    // Missing required fields
    lines.push(`🟡 <b>Missing required fields</b>: ${issues.missingRequiredFields.length}`);
    issues.missingRequiredFields.forEach(t => {
        const missing = [];
        if (!getTitle(t) || getTitle(t) === 'Untitled') missing.push('title');
        if (!t.properties?.Priority?.select?.name) missing.push('priority');
        if (!t.properties?.Status?.status?.name) missing.push('status');
        lines.push(`  • <a href="${t.url}">${escapeHtml(getTitle(t))}</a> — missing: ${missing.join(', ')}`);
    });
    lines.push('');

    // Missing description
    lines.push(`📝 <b>Tasks missing description</b>: ${issues.missingDescription.length}`);
    lines.push(`📝 <b>Projects missing description</b>: ${issues.projectsMissingDescription.length}`);

    // Summary
    const totalIssues =
        issues.orphanedTasks.length +
        issues.projectsWithoutGoal.length +
        issues.overdueDueDate.length +
        issues.overdueScheduled.length +
        issues.missingRequiredFields.length;

    lines.push('');
    if (totalIssues === 0) {
        lines.push('✅ <b>Your Notion workspace is healthy!</b>');
    } else {
        lines.push(`⚡ <b>${totalIssues} issues need attention</b>`);
    }

    return lines.join('\n');
}

module.exports = {
    runHealthCheck,
    formatHealthReport
};
