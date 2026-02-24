/**
 * REST API Routes for Web Interface
 */
import { Router, Request, Response } from 'express';
import { fetchTasks, fetchProjects, fetchGoals, getTitle, getDate, isCompleted, hasRelation, getRelationIds, isActiveProject, isEvergreen, getProjectStatusCategory, isBlocked, getDescription, NotionPage, getTaskByShortId, updateTaskStatus, getStatus, getSelect } from '../notion/client';
import { getWeeklyReview } from '../notion/weeklyReview';
import { runHealthCheck } from '../notion/health';
import { runStrategyAnalysis } from '../pm/strategy';
import { getTodayTasks } from '../commands/todayTasks';
import { getStrategicAdvice, generateMotivation } from '../ai/gemini';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeTask(t: NotionPage) {
    return {
        id: t.id,
        title: getTitle(t),
        status: getStatus(t) || null,
        priority: getSelect(t, 'Priority') || null,
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
        status: getStatus(p) || getSelect(p, 'Status') || null,
        statusCategory: getProjectStatusCategory(p),
        blocked: isBlocked(p),
        active: isActiveProject(p),
        evergreen: isEvergreen(p),
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

/** Get task by short numeric ID */
router.get('/tasks/short/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid short ID' });
        }
        const task = await getTaskByShortId(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(serializeTask(task));
    } catch (err) {
        console.error('Task by short ID API error:', err);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

/** Update task status by short ID */
router.patch('/tasks/short/:id/status', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid short ID' });
        }
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const task = await getTaskByShortId(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const updatedTask = await updateTaskStatus(task.id, status);
        res.json(serializeTask(updatedTask));
    } catch (err) {
        console.error('Update task status API error:', err);
        res.status(500).json({ error: 'Failed to update task status' });
    }
});

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
        const analysis = await runStrategyAnalysis();

        const totalIssues =
            health.issues.orphanedTasks.length +
            health.issues.projectsWithoutGoal.length +
            health.issues.overdueDueDate.length +
            health.issues.overdueScheduled.length +
            health.issues.missingRequiredFields.length;

        // Calculate today's impact: which projects/goals are affected by today's tasks
        const todayTaskIds = new Set(todayTasks.map((t: { id: string }) => t.id));
        const projectsAffected = new Map<string, { title: string; url: string; taskCount: number }>();

        for (const task of activeTasks) {
            if (!todayTaskIds.has(task.id)) continue;
            const relIds = getRelationIds(task, 'Project') || getRelationIds(task, 'Projects') || [];
            for (const pid of relIds) {
                const proj = projects.find(p => p.id === pid);
                if (proj && isActiveProject(proj)) {
                    const existing = projectsAffected.get(pid);
                    if (existing) {
                        existing.taskCount++;
                    } else {
                        projectsAffected.set(pid, {
                            title: getTitle(proj),
                            url: proj.url,
                            taskCount: 1,
                        });
                    }
                }
            }
        }

        // Find goals linked to affected projects
        const goalsAffected: Array<{ title: string; url: string; progress: number; projectsInGoal: number }> = [];
        const affectedProjectIds = new Set(projectsAffected.keys());
        for (const goal of activeGoals) {
            const goalRelIds = getRelationIds(goal, 'Projects') || getRelationIds(goal, 'Project') || [];
            const hasAffectedProject = goalRelIds.some(id => affectedProjectIds.has(id));
            if (hasAffectedProject) {
                const progress = analysis.progress.find(p => p.id === goal.id);
                goalsAffected.push({
                    title: getTitle(goal),
                    url: goal.url,
                    progress: progress ? progress.percent : 0,
                    projectsInGoal: goalRelIds.length,
                });
            }
        }

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
            todayImpact: {
                projectsAffected: [...projectsAffected.values()],
                goalsAffected,
            },
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
                missingDescription: health.issues.missingDescription.map(serializeTask),
                projectsMissingDescription: health.issues.projectsMissingDescription.map(serializeProject),
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

/** AI motivation - generate a motivational message based on today's work */
router.post('/ai/motivation', async (_req: Request, res: Response) => {
    try {
        const [todayTasks, goals, projects] = await Promise.all([
            getTodayTasks(5),
            fetchGoals(),
            fetchProjects(),
        ]);
        const analysis = await runStrategyAnalysis();
        const activeGoals = goals.filter(g => !isCompleted(g));
        const motivation = await generateMotivation(todayTasks, activeGoals.map(g => ({
            title: getTitle(g),
            progress: analysis.progress.find(p => p.id === g.id)?.percent || 0,
        })), projects.filter(isActiveProject).map(getTitle));
        res.json({ motivation });
    } catch (err) {
        console.error('Motivation API error:', err);
        res.status(500).json({ error: 'Failed to generate motivation' });
    }
});

/** Actionable projects - only projects that can be acted on today */
router.get('/projects/actionable', async (_req: Request, res: Response) => {
    try {
        const [projects, tasks] = await Promise.all([fetchProjects(), fetchTasks()]);
        const activeTasks = tasks.filter(t => !isCompleted(t));

        // Actionable = active status + not blocked + not evergreen
        const actionableProjects = projects.filter(isActiveProject);

        const serialized = actionableProjects.map(p => {
            const linkedTasks = activeTasks.filter(t => {
                const ids = getRelationIds(t, 'Project') || getRelationIds(t, 'Projects');
                return ids.includes(p.id);
            });

            const lastEdited = new Date(p.last_edited_time);
            const daysSinceUpdate = Math.floor((Date.now() - lastEdited.getTime()) / (1000 * 60 * 60 * 24));

            return {
                ...serializeProject(p),
                taskCount: linkedTasks.length,
                lastUpdated: p.last_edited_time,
                daysSinceUpdate,
                stalled: daysSinceUpdate > 14, // Flag projects not touched in 2 weeks
            };
        });

        res.json({
            count: serialized.length,
            projects: serialized,
        });
    } catch (err) {
        console.error('Actionable projects API error:', err);
        res.status(500).json({ error: 'Failed to load actionable projects' });
    }
});

/** Blocked projects - waiting on external dependencies */
router.get('/projects/blocked', async (_req: Request, res: Response) => {
    try {
        const [projects, tasks] = await Promise.all([fetchProjects(), fetchTasks()]);
        const activeTasks = tasks.filter(t => !isCompleted(t));

        // Blocked = has active/ready status AND blocked checkbox
        const blockedProjects = projects.filter(p => {
            const category = getProjectStatusCategory(p);
            return (category === 'ACTIVE' || category === 'READY') && isBlocked(p);
        });

        const serialized = blockedProjects.map(p => {
            const linkedTasks = activeTasks.filter(t => {
                const ids = getRelationIds(t, 'Project') || getRelationIds(t, 'Projects');
                return ids.includes(p.id);
            });

            const lastEdited = new Date(p.last_edited_time);
            const daysSinceUpdate = Math.floor((Date.now() - lastEdited.getTime()) / (1000 * 60 * 60 * 24));

            return {
                ...serializeProject(p),
                taskCount: linkedTasks.length,
                lastUpdated: p.last_edited_time,
                daysSinceUpdate,
                needsFollowUp: daysSinceUpdate > 7, // Flag if no update in a week
            };
        });

        res.json({
            count: serialized.length,
            projects: serialized,
        });
    } catch (err) {
        console.error('Blocked projects API error:', err);
        res.status(500).json({ error: 'Failed to load blocked projects' });
    }
});

/** Project summary - high-level overview for daily briefings */
router.get('/projects/summary', async (_req: Request, res: Response) => {
    try {
        const [projects, tasks] = await Promise.all([fetchProjects(), fetchTasks()]);
        const activeTasks = tasks.filter(t => !isCompleted(t));

        const actionable = projects.filter(isActiveProject);
        const blocked = projects.filter(p => {
            const category = getProjectStatusCategory(p);
            return (category === 'ACTIVE' || category === 'READY') && isBlocked(p);
        });
        const evergreen = projects.filter(p => {
            const category = getProjectStatusCategory(p);
            return (category === 'ACTIVE' || category === 'READY') && isEvergreen(p);
        });

        // Find stalled projects (actionable but not updated in 14+ days)
        const stalled = actionable.filter(p => {
            const lastEdited = new Date(p.last_edited_time);
            const daysSinceUpdate = Math.floor((Date.now() - lastEdited.getTime()) / (1000 * 60 * 60 * 24));
            return daysSinceUpdate > 14;
        });

        // Count tasks per project type
        const actionableTaskCount = actionable.reduce((sum, p) => {
            const count = activeTasks.filter(t => {
                const ids = getRelationIds(t, 'Project') || getRelationIds(t, 'Projects');
                return ids.includes(p.id);
            }).length;
            return sum + count;
        }, 0);

        res.json({
            overview: {
                actionable: actionable.length,
                blocked: blocked.length,
                evergreen: evergreen.length,
                stalled: stalled.length,
                total: projects.filter(p => {
                    const cat = getProjectStatusCategory(p);
                    return cat === 'ACTIVE' || cat === 'READY';
                }).length,
            },
            actionableProjects: actionable.map(p => ({
                title: getTitle(p),
                url: p.url,
                taskCount: activeTasks.filter(t => {
                    const ids = getRelationIds(t, 'Project') || getRelationIds(t, 'Projects');
                    return ids.includes(p.id);
                }).length,
            })),
            blockedProjects: blocked.map(p => ({
                title: getTitle(p),
                url: p.url,
                daysSinceUpdate: Math.floor((Date.now() - new Date(p.last_edited_time).getTime()) / (1000 * 60 * 60 * 24)),
            })),
            stalledProjects: stalled.map(p => ({
                title: getTitle(p),
                url: p.url,
                daysSinceUpdate: Math.floor((Date.now() - new Date(p.last_edited_time).getTime()) / (1000 * 60 * 60 * 24)),
            })),
            metrics: {
                actionableTaskCount,
                avgTasksPerActionableProject: actionable.length > 0 ? (actionableTaskCount / actionable.length).toFixed(1) : '0',
            },
        });
    } catch (err) {
        console.error('Project summary API error:', err);
        res.status(500).json({ error: 'Failed to generate project summary' });
    }
});

/**
 * Weekly Review — completed tasks, projects, and goals for a given ISO week.
 *
 * Query params:
 *   ?week=YYYY-MM-DD  (optional) Monday of the desired week. Defaults to current week.
 *
 * Examples:
 *   GET /api/weekly-review
 *   GET /api/weekly-review?week=2026-02-16
 *
 * Errors:
 *   400  if `week` is not a valid date or not a Monday
 *   500  on unexpected failures
 */
router.get('/weekly-review', async (req: Request, res: Response) => {
    try {
        const weekParam = typeof req.query.week === 'string' ? req.query.week : undefined;
        const result = await getWeeklyReview(weekParam);
        res.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const isClientError = message.includes('not a Monday') || message.includes('Invalid date');
        res.status(isClientError ? 400 : 500).json({ error: message });
    }
});

export default router;
