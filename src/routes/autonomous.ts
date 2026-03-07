import { Router, Request, Response } from 'express';
import { 
    queryDatabaseFiltered, 
    getTitle, 
    getNumber, 
    updatePage,
    getSelect
} from '../notion/client';

const router = Router();

const NOTION_TASKS_DB = process.env.NOTION_TASKS_DB!;
const NOTION_PROJECTS_DB = process.env.NOTION_PROJECTS_DB!;

/**
 * GET /api/autonomous/queue
 * Returns a correctly ordered list of tasks across all autonomous projects.
 * Logic: Fetch projects with Autonomous=true and Status != Done.
 * Then fetch tasks for those projects with Autonomous Pickup=true and Status=Not Started.
 */
router.get('/queue', async (_req: Request, res: Response) => {
    try {
        const projects = await queryDatabaseFiltered(NOTION_PROJECTS_DB, {
            and: [
                { property: 'Autonomous', checkbox: { equals: true } },
                { property: 'Status', status: { does_not_equal: 'Done' } }
            ]
        });

        if (projects.length === 0) {
            return res.json({ ok: true, tasks: [] });
        }

        const projectMap = new Map<string, { title: string, repo: string | null }>();
        projects.forEach(p => {
            const github = (p.properties['GitHub'] as any)?.url;
            const staging = (p.properties['Staging URL'] as any)?.url;
            const repo = getSelect(p, 'Repo Path') || github || staging || null;
            projectMap.set(p.id, {
                title: getTitle(p),
                repo: repo
            });
        });

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

        const queue = tasks.map(t => {
            const projRel = t.properties['Project'] as any;
            const projId = projRel?.relation?.[0]?.id;
            const proj = projId ? projectMap.get(projId) : null;
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

/**
 * PATCH /api/autonomous/tasks/:id/status
 * Generic helper for any runner to update Notion state.
 */
router.patch('/tasks/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, outcome, blockedReason } = req.body;
        const props: any = {};
        if (status) props['Status'] = { status: { name: status } };
        if (outcome) props['Outcome'] = { rich_text: [{ text: { content: outcome } }] };
        if (blockedReason) props['Blocked Reason'] = { rich_text: [{ text: { content: blockedReason } }] };
        await updatePage(id as string, props);
        res.json({ ok: true });
    } catch (error) {
        console.error('Task status update error:', error);
        res.status(500).json({ ok: false, error: 'Failed to update task status' });
    }
});

/**
 * POST /api/autonomous/trigger
 * NO-OP: Deprecated. The team handles execution now.
 */
router.post('/trigger', async (_req: Request, res: Response) => {
    res.json({ ok: true, message: 'Trigger logic removed. External agents should poll /queue.' });
});

export default router;
