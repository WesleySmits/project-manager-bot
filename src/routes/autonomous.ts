import { Router, Request, Response } from 'express';
import { 
    queryDatabaseFiltered, 
    getTitle, 
    getStatus, 
    getCheckbox, 
    getNumber, updatePage, 
    NotionPage, 
    isActiveProject,
    getSelect
} from '../notion/client';

const router = Router();

const NOTION_TASKS_DB = process.env.NOTION_TASKS_DB!;
const NOTION_PROJECTS_DB = process.env.NOTION_PROJECTS_DB!;

interface AutonomousTask {
    id: string;
    title: string;
    sequence: number;
    projectId: string;
    projectTitle: string;
    repoPath: string | null;
    outcome: string | null;
    dod: string | null;
}

/**
 * GET /api/autonomous/queue
 * Returns a correctly ordered list of tasks across all autonomous projects
 * that are ready for pickup.
 */
router.get('/queue', async (_req: Request, res: Response) => {
    try {
        // 1. Fetch all autonomous projects that are ACTIVE
        const projects = await queryDatabaseFiltered(NOTION_PROJECTS_DB, {
            and: [
                { property: 'Autonomous', checkbox: { equals: true } },
                { property: 'Status', status: { equals: 'In progress' } }
            ]
        });

        if (projects.length === 0) {
            return res.json({ ok: true, tasks: [] });
        }

        const projectMap = new Map<string, { title: string, repo: string | null }>();
        projects.forEach(p => {
            // Get repo path from Project URL or a dedicated 'Repo Path' field if it exists
            const repo = getSelect(p, 'Repo Path') || (p.properties['Project URL'] as any)?.url || null;
            projectMap.set(p.id, {
                title: getTitle(p),
                repo: repo
            });
        });

        // 2. Fetch all tasks for these projects that have 'Autonomous Pickup' enabled and are 'Not Started'
        const tasks = await queryDatabaseFiltered(NOTION_TASKS_DB, {
            and: [
                { property: 'Autonomous Pickup', checkbox: { equals: true } },
                { property: 'Status', status: { equals: 'Not Started' } },
                {
                    or: projects.map(p => ({
                        property: 'Project',
                        relation: { contains: p.id }
                    }))
                }
            ]
        }, [
            { property: 'Sequence', direction: 'ascending' }
        ]);

        const queue: AutonomousTask[] = tasks.map(t => {
            const projId = (t.properties['Project'] as any)?.relation?.[0]?.id;
            const proj = projectMap.get(projId);
            
            return {
                id: t.id,
                title: getTitle(t),
                sequence: getNumber(t, 'Sequence') || 999,
                projectId: projId,
                projectTitle: proj?.title || 'Unknown',
                repoPath: proj?.repo || null,
                outcome: (t.properties['Outcome'] as any)?.rich_text?.[0]?.plain_text || null,
                dod: (t.properties['DoD'] as any)?.rich_text?.[0]?.plain_text || null
            };
        });

        res.json({ ok: true, tasks: queue });
    } catch (error) {
        console.error('Autonomous queue error:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch autonomous queue' });
    }
});

export default router;

/**
 * PATCH /api/autonomous/tasks/:id/status
 * Helper for the runner to update task status during execution.
 */
router.patch('/tasks/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, outcome, blockedReason } = req.body;
        
        const props: any = {};
        if (status) {
            props['Status'] = { status: { name: status } };
        }
        if (outcome) {
            props['Outcome'] = { rich_text: [{ text: { content: outcome } }] };
        }
        if (blockedReason) {
            props['Blocked Reason'] = { rich_text: [{ text: { content: blockedReason } }] };
        }

        await updatePage(id, props);
        res.json({ ok: true });
    } catch (error) {
        console.error('Task status update error:', error);
        res.status(500).json({ ok: false, error: 'Failed to update task status' });
    }
});

/**
 * POST /api/autonomous/trigger
 * Manual trigger for the heartbeat logic.
 */
router.post('/trigger', async (_req: Request, res: Response) => {
    // This is a bridge to the runner logic
    res.json({ ok: true, message: 'Autonomous engine tick triggered' });
    
    // Lazy import and run to avoid circular deps during scaffold
    const { runAutonomousTask } = require('../pm/runner');
    
    try {
        const queueRes = await fetch(`${process.env.PM_API_INTERNAL_URL || 'http://localhost:3301'}/api/autonomous/queue`, {
            headers: { 'X-API-Key': process.env.API_KEY! }
        });
        const { tasks } = await queueRes.json();
        
        if (tasks && tasks.length > 0) {
            await runAutonomousTask(tasks[0]);
        }
    } catch (e) {
        console.error('Trigger error:', e);
    }
});
