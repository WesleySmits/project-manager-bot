/**
 * REST API Routes for Web Interface
 */
import { Router, Request, Response } from 'express';
import { fetchTasks, fetchProjects, fetchGoals, getTitle, getDate, isCompleted, hasRelation, getRelationIds, isActiveProject, getProjectStatusCategory, isBlocked, getDescription, NotionPage } from '../notion/client';
import { runHealthCheck } from '../notion/health';
import { runStrategyAnalysis } from '../pm/strategy';
import { getTodayTasks } from '../commands/todayTasks';
import { getStrategicAdvice } from '../ai/gemini';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeTask(t: NotionPage) {
    return {
        id: t.id,
        title: getTitle(t),
        status: t.properties?.Status?.status?.name || null,
        priority: t.properties?.Priority?.select?.name || null,
        dueDate: getDate(t, 'Due Date') || getDate(t, 'Due') || null,
        scheduledDate: getDate(t, 'Scheduled') || null,
        hasProject: hasRelation(t),
        completed: isCompleted(t),
        url: t.url,
    };
}

function serializeProject(p: NotionPage) {
    return {
        id: p.id,
        title: getTitle(p),
        status: p.properties?.Status?.status?.name || p.properties?.Status?.select?.name || null,
        statusCategory: getProjectStatusCategory(p),
        blocked: isBlocked(p),
        active: isActiveProject(p),
        description: getDescription(p),
        url: p.url,
    };
}

function serializeGoal(g: NotionPage) {
    return {
        id: g.id,
        title: getTitle(g),
        completed: isCompleted(g),
        description: getDescription(g),
        url: g.url,
    };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** System health */
router.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'project-manager',
        timestamp: new Date().toISOString(),
    });
});

/** Dashboard aggregated data */
router.get('/dashboard', async (_req: Request, res: Response) => {
    try {
        const [tasks, projects, goals, health, todayTasks] = await Promise.all([
            fetchTasks(),
            fetchProjects(),
            fetchGoals(),
            runHealthCheck(),
            getTodayTasks(5),
        ]);

        const activeTasks = tasks.filter(t => !isCompleted(t));
        const activeProjects = projects.filter(isActiveProject);
        const activeGoals = goals.filter(g => !isCompleted(g));

        const totalIssues =
            health.issues.orphanedTasks.length +
            health.issues.projectsWithoutGoal.length +
            health.issues.overdueDueDate.length +
            health.issues.overdueScheduled.length +
            health.issues.missingRequiredFields.length;

        res.json({
            metrics: {
                activeTasks: activeTasks.length,
                totalTasks: tasks.length,
                activeProjects: activeProjects.length,
                totalProjects: projects.length,
                activeGoals: activeGoals.length,
                totalGoals: goals.length,
                healthIssues: totalIssues,
            },
            todayTasks,
            overdueTasks: health.issues.overdueDueDate.map(serializeTask),
        });
    } catch (err) {
        console.error('Dashboard API error:', err);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

/** All tasks */
router.get('/tasks', async (_req: Request, res: Response) => {
    try {
        const tasks = await fetchTasks();
        res.json(tasks.map(serializeTask));
    } catch (err) {
        console.error('Tasks API error:', err);
        res.status(500).json({ error: 'Failed to load tasks' });
    }
});

/** All projects */
router.get('/projects', async (_req: Request, res: Response) => {
    try {
        const [projects, tasks] = await Promise.all([fetchProjects(), fetchTasks()]);
        const activeTasks = tasks.filter(t => !isCompleted(t));

        const serialized = projects.map(p => {
            const linkedTasks = activeTasks.filter(t => {
                const ids = getRelationIds(t, 'Project') || getRelationIds(t, 'Projects');
                return ids.includes(p.id);
            });
            return {
                ...serializeProject(p),
                taskCount: linkedTasks.length,
            };
        });

        res.json(serialized);
    } catch (err) {
        console.error('Projects API error:', err);
        res.status(500).json({ error: 'Failed to load projects' });
    }
});

/** All goals with progress */
router.get('/goals', async (_req: Request, res: Response) => {
    try {
        const analysis = await runStrategyAnalysis();
        const goals = await fetchGoals();

        const serialized = goals.filter(g => !isCompleted(g)).map(g => {
            const progress = analysis.progress.find(p => p.id === g.id);
            return {
                ...serializeGoal(g),
                progress: progress ? progress.percent : 0,
                projectCount: progress ? progress.total : 0,
                completedProjects: progress ? progress.completed : 0,
            };
        });

        res.json(serialized);
    } catch (err) {
        console.error('Goals API error:', err);
        res.status(500).json({ error: 'Failed to load goals' });
    }
});

/** Health analysis */
router.get('/analysis/health', async (_req: Request, res: Response) => {
    try {
        const health = await runHealthCheck();
        res.json({
            totals: health.totals,
            issues: {
                orphanedTasks: health.issues.orphanedTasks.map(serializeTask),
                projectsWithoutGoal: health.issues.projectsWithoutGoal.map(serializeProject),
                overdueDueDate: health.issues.overdueDueDate.map(serializeTask),
                overdueScheduled: health.issues.overdueScheduled.map(serializeTask),
                missingRequiredFields: health.issues.missingRequiredFields.map(serializeTask),
                missingDescription: health.issues.missingDescription.length,
                projectsMissingDescription: health.issues.projectsMissingDescription.length,
            },
        });
    } catch (err) {
        console.error('Health API error:', err);
        res.status(500).json({ error: 'Failed to run health check' });
    }
});

/** Strategy analysis */
router.get('/analysis/strategy', async (_req: Request, res: Response) => {
    try {
        const analysis = await runStrategyAnalysis();
        res.json({
            metrics: analysis.metrics,
            issues: {
                stalledGoals: analysis.issues.stalledGoals.map(serializeGoal),
                zombieProjects: analysis.issues.zombieProjects.map(serializeProject),
                isOverloaded: analysis.issues.isOverloaded,
            },
            progress: analysis.progress,
        });
    } catch (err) {
        console.error('Strategy API error:', err);
        res.status(500).json({ error: 'Failed to run strategy analysis' });
    }
});

/** AI insight */
router.post('/ai/insight', async (_req: Request, res: Response) => {
    try {
        const analysis = await runStrategyAnalysis();
        const advice = await getStrategicAdvice(analysis);
        res.json({ insight: advice });
    } catch (err) {
        console.error('AI Insight API error:', err);
        res.status(500).json({ error: 'Failed to generate insight' });
    }
});

export default router;
