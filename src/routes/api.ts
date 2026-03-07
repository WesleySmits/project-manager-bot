/**
 * REST API Routes for Web Interface
 */
import { Router, Request, Response } from 'express';
import { getProvider, Task, Project, Goal } from '../providers';
import { getWeeklyReview } from '../notion/weeklyReview';
import { runHealthCheck } from '../notion/health';
import { runStrategyAnalysis } from '../pm/strategy';
import { getTodayTasks } from '../commands/todayTasks';
import { getStrategicAdvice, generateMotivation } from '../ai/gemini';

const router = Router();

// ─── Serializers (normalized types → API response shape) ─────────────────────

function serializeTask(t: Task) {
    return {
        id: t.id,
        shortId: t.shortId,
        title: t.title,
        status: t.status ?? null,
        priority: t.priority ?? null,
        dueDate: t.dueDate ?? null,
        scheduledDate: t.scheduledDate ?? null,
        hasProject: t.projectId !== null,
        completed: t.completed,
        url: t.url,
    };
}

function serializeProject(p: Project) {
    return {
        id: p.id,
        title: p.title,
        status: p.status ?? null,
        statusCategory: p.statusCategory,
        blocked: p.blocked,
        active: p.active,
        evergreen: p.evergreen,
        description: p.description,
        url: p.url,
    };
}

function serializeGoal(g: Goal) {
    return {
        id: g.id,
        title: g.title,
        completed: g.completed,
        description: g.description,
        url: g.url,
    };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** Get task by short numeric ID */
router.get('/tasks/short/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid short ID' });
        const task = await getProvider().getTaskByShortId(id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
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
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid short ID' });
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'Status is required' });

        const provider = getProvider();
        const task = await provider.getTaskByShortId(id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const updated = await provider.updateTaskStatus(task.id, status);
        res.json(serializeTask(updated));
    } catch (err) {
        console.error('Update task status API error:', err);
        res.status(500).json({ error: 'Failed to update task status' });
    }
});

/** System health */
router.get('/health', (_req: Request, res: Response) => {
    const provider = getProvider();
    res.json({
        status: 'ok',
        service: 'project-manager',
        provider: provider.name,
        timestamp: new Date().toISOString(),
    });
});

/** Dashboard aggregated data */
router.get('/dashboard', async (_req: Request, res: Response) => {
    try {
        const provider = getProvider();
        const [tasks, projects, goals, todayTasks] = await Promise.all([
            provider.fetchTasks(),
            provider.fetchProjects(),
            provider.fetchGoals(),
            getTodayTasks(5),
        ]);

        const activeTasks = tasks.filter(t => !t.completed);
        const activeProjects = projects.filter(p => p.active);
        const activeGoals = goals.filter(g => !g.completed);
        const analysis = await runStrategyAnalysis();

        // Health check (Notion-specific, graceful degradation for other providers)
        let healthIssues = 0;
        let overdueTasks: any[] = [];
        try {
            const health = await runHealthCheck();
            healthIssues =
                health.issues.orphanedTasks.length +
                health.issues.projectsWithoutGoal.length +
                health.issues.overdueDueDate.length +
                health.issues.overdueScheduled.length +
                health.issues.missingRequiredFields.length;
            overdueTasks = health.issues.overdueDueDate.map((t: any) => ({
                id: t.id,
                shortId: null,
                title: t.properties?.['Name']?.title?.[0]?.plain_text ?? 'Untitled',
                status: t.properties?.['Status']?.status?.name ?? null,
                priority: t.properties?.['Priority']?.select?.name ?? null,
                dueDate: t.properties?.['Due Date']?.date?.start ?? null,
                scheduledDate: null,
                projectId: null,
                url: t.url,
                completed: false,
            }));
        } catch {
            const ph = await provider.healthCheck();
            healthIssues = ph.issues.filter(i => i.severity === 'error').length;
        }

        // Today's impact: which projects/goals are touched by today's top tasks
        const todayTaskIds = new Set(todayTasks.map((t: { id: string }) => t.id));
        const projectsAffectedMap = new Map<string, { title: string; url: string; taskCount: number }>();

        for (const task of activeTasks) {
            if (!todayTaskIds.has(task.id) || !task.projectId) continue;
            const proj = projects.find(p => p.id === task.projectId);
            if (proj?.active) {
                const existing = projectsAffectedMap.get(task.projectId);
                if (existing) existing.taskCount++;
                else projectsAffectedMap.set(task.projectId, { title: proj.title, url: proj.url, taskCount: 1 });
            }
        }

        const affectedProjectIds = new Set(projectsAffectedMap.keys());
        const goalsAffected = activeGoals
            .filter(g => g.id && projects.some(p => p.goalIds.includes(g.id) && affectedProjectIds.has(p.id)))
            .map(g => {
                const progress = analysis.progress.find(p => p.id === g.id);
                return {
                    title: g.title,
                    url: g.url,
                    progress: progress?.percent ?? 0,
                };
            });

        res.json({
            metrics: {
                activeTasks: activeTasks.length,
                totalTasks: tasks.length,
                activeProjects: activeProjects.length,
                totalProjects: projects.length,
                activeGoals: activeGoals.length,
                totalGoals: goals.length,
                healthIssues,
            },
            todayTasks,
            overdueTasks: overdueTasks.map(serializeTask),
            todayImpact: {
                projectsAffected: [...projectsAffectedMap.values()],
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
        const tasks = await getProvider().fetchTasks();
        res.json(tasks.map(serializeTask));
    } catch (err) {
        res.status(500).json({ error: 'Failed to load tasks' });
    }
});

/** All projects with task counts */
router.get('/projects', async (_req: Request, res: Response) => {
    try {
        const provider = getProvider();
        const [projects, tasks] = await Promise.all([provider.fetchProjects(), provider.fetchTasks()]);
        const activeTasks = tasks.filter(t => !t.completed);

        const serialized = projects.map(p => ({
            ...serializeProject(p),
            taskCount: activeTasks.filter(t => t.projectId === p.id).length,
        }));
        res.json(serialized);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load projects' });
    }
});

/** All goals with progress */
router.get('/goals', async (_req: Request, res: Response) => {
    try {
        const provider = getProvider();
        const [analysis, goals] = await Promise.all([runStrategyAnalysis(), provider.fetchGoals()]);

        const serialized = goals.filter(g => !g.completed).map(g => {
            const progress = analysis.progress.find(p => p.id === g.id);
            return {
                ...serializeGoal(g),
                progress: progress?.percent ?? 0,
                projectCount: progress?.total ?? 0,
                completedProjects: progress?.completed ?? 0,
            };
        });
        res.json(serialized);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load goals' });
    }
});

/** Health analysis (Notion-specific; degrades gracefully for other providers) */
router.get('/analysis/health', async (_req: Request, res: Response) => {
    try {
        if (process.env.PROVIDER === 'notion' || !process.env.PROVIDER) {
            const health = await runHealthCheck();
            return res.json({
                totals: health.totals,
                issues: {
                    orphanedTasks: health.issues.orphanedTasks.map((t: any) => serializeTask({
                        id: t.id, shortId: null, title: t.properties?.['Name']?.title?.[0]?.plain_text ?? 'Untitled',
                        status: 'unknown', priority: null, dueDate: null, scheduledDate: null,
                        projectId: null, url: t.url ?? '', completed: false,
                    } as any)),
                    projectsWithoutGoal: health.issues.projectsWithoutGoal.map((p: any) => serializeProject({
                        id: p.id, title: p.properties?.['Name']?.title?.[0]?.plain_text ?? 'Untitled',
                        status: null, statusCategory: 'UNKNOWN', blocked: false,
                        active: false, evergreen: false, goalIds: [], url: p.url ?? '', description: null,
                    })),
                    overdueDueDate: health.issues.overdueDueDate.map((t: any) => serializeTask({
                        id: t.id, shortId: null, title: t.properties?.['Name']?.title?.[0]?.plain_text ?? 'Untitled',
                        status: 'unknown', priority: null, dueDate: null, scheduledDate: null,
                        projectId: null, url: t.url ?? '', completed: false,
                    } as any)),
                    overdueScheduled: health.issues.overdueScheduled.map((t: any) => serializeTask({
                        id: t.id, shortId: null, title: t.properties?.['Name']?.title?.[0]?.plain_text ?? 'Untitled',
                        status: 'unknown', priority: null, dueDate: null, scheduledDate: null,
                        projectId: null, url: t.url ?? '', completed: false,
                    } as any)),
                    missingRequiredFields: health.issues.missingRequiredFields.map((t: any) => serializeTask({
                        id: t.id, shortId: null, title: t.properties?.['Name']?.title?.[0]?.plain_text ?? 'Untitled',
                        status: 'unknown', priority: null, dueDate: null, scheduledDate: null,
                        projectId: null, url: t.url ?? '', completed: false,
                    } as any)),
                },
            });
        }

        // Generic fallback for non-Notion providers
        const result = await getProvider().healthCheck();
        res.json({ totals: result.stats, issues: result.issues });
    } catch (err) {
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
        res.status(500).json({ error: 'Failed to generate insight' });
    }
});

/** AI motivation */
router.post('/ai/motivation', async (_req: Request, res: Response) => {
    try {
        const provider = getProvider();
        const [todayTasks, goals, projects, analysis] = await Promise.all([
            getTodayTasks(5),
            provider.fetchGoals(),
            provider.fetchProjects(),
            runStrategyAnalysis(),
        ]);
        const activeGoals = goals.filter(g => !g.completed);
        const motivation = await generateMotivation(
            todayTasks,
            activeGoals.map(g => ({ title: g.title, progress: analysis.progress.find(p => p.id === g.id)?.percent ?? 0 })),
            projects.filter(p => p.active).map(p => p.title),
        );
        res.json({ motivation });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate motivation' });
    }
});

/** Actionable projects */
router.get('/projects/actionable', async (_req: Request, res: Response) => {
    try {
        const provider = getProvider();
        const [projects, tasks] = await Promise.all([provider.fetchProjects(), provider.fetchTasks()]);
        const activeTasks = tasks.filter(t => !t.completed);

        const actionable = projects.filter(p => p.active).map(p => {
            const taskCount = activeTasks.filter(t => t.projectId === p.id).length;
            const raw = p.raw as any;
            const lastEdited = raw?.last_edited_time ? new Date(raw.last_edited_time) : null;
            const daysSinceUpdate = lastEdited ? Math.floor((Date.now() - lastEdited.getTime()) / 86_400_000) : null;
            return { ...serializeProject(p), taskCount, daysSinceUpdate, stalled: (daysSinceUpdate ?? 0) > 14 };
        });

        res.json({ count: actionable.length, projects: actionable });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load actionable projects' });
    }
});

/** Blocked projects */
router.get('/projects/blocked', async (_req: Request, res: Response) => {
    try {
        const provider = getProvider();
        const [projects, tasks] = await Promise.all([provider.fetchProjects(), provider.fetchTasks()]);
        const activeTasks = tasks.filter(t => !t.completed);

        const blocked = projects
            .filter(p => p.blocked && (p.statusCategory === 'ACTIVE' || p.statusCategory === 'READY'))
            .map(p => {
                const taskCount = activeTasks.filter(t => t.projectId === p.id).length;
                const raw = p.raw as any;
                const lastEdited = raw?.last_edited_time ? new Date(raw.last_edited_time) : null;
                const daysSinceUpdate = lastEdited ? Math.floor((Date.now() - lastEdited.getTime()) / 86_400_000) : null;
                return { ...serializeProject(p), taskCount, daysSinceUpdate, needsFollowUp: (daysSinceUpdate ?? 0) > 7 };
            });

        res.json({ count: blocked.length, projects: blocked });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load blocked projects' });
    }
});

/** Project summary */
router.get('/projects/summary', async (_req: Request, res: Response) => {
    try {
        const provider = getProvider();
        const [projects, tasks] = await Promise.all([provider.fetchProjects(), provider.fetchTasks()]);
        const activeTasks = tasks.filter(t => !t.completed);

        const actionable = projects.filter(p => p.active);
        const blocked = projects.filter(p => p.blocked && (p.statusCategory === 'ACTIVE' || p.statusCategory === 'READY'));
        const evergreen = projects.filter(p => p.evergreen && (p.statusCategory === 'ACTIVE' || p.statusCategory === 'READY'));

        const stalled = actionable.filter(p => {
            const raw = p.raw as any;
            if (!raw?.last_edited_time) return false;
            return Math.floor((Date.now() - new Date(raw.last_edited_time).getTime()) / 86_400_000) > 14;
        });

        const actionableTaskCount = actionable.reduce((sum, p) => sum + activeTasks.filter(t => t.projectId === p.id).length, 0);

        res.json({
            overview: {
                actionable: actionable.length,
                blocked: blocked.length,
                evergreen: evergreen.length,
                stalled: stalled.length,
                total: projects.filter(p => p.statusCategory === 'ACTIVE' || p.statusCategory === 'READY').length,
            },
            actionableProjects: actionable.map(p => ({
                title: p.title, url: p.url,
                taskCount: activeTasks.filter(t => t.projectId === p.id).length,
            })),
            blockedProjects: blocked.map(p => {
                const raw = p.raw as any;
                return { title: p.title, url: p.url, daysSinceUpdate: raw?.last_edited_time ? Math.floor((Date.now() - new Date(raw.last_edited_time).getTime()) / 86_400_000) : null };
            }),
            stalledProjects: stalled.map(p => {
                const raw = p.raw as any;
                return { title: p.title, url: p.url, daysSinceUpdate: Math.floor((Date.now() - new Date(raw.last_edited_time).getTime()) / 86_400_000) };
            }),
            metrics: {
                actionableTaskCount,
                avgTasksPerActionableProject: actionable.length > 0 ? (actionableTaskCount / actionable.length).toFixed(1) : '0',
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate project summary' });
    }
});

/** Weekly review (Notion-specific) */
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
