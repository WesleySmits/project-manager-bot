import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Project Runner: The core logic for executing an autonomous task.
 * Follows the "Fast-Track Main" and "Rule of Three" policies.
 */
export async function runAutonomousTask(task: any) {
    const { id, title, repoPath, outcome: targetOutcome, dod } = task;
    const pmApiUrl = process.env.PM_API_INTERNAL_URL || 'http://localhost:3301';
    const apiKey = process.env.API_KEY;

    const updateStatus = async (status: string, outcome?: string, blockedReason?: string) => {
        await fetch(`${pmApiUrl}/api/autonomous/tasks/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey! },
            body: JSON.stringify({ status, outcome, blockedReason })
        });
    };

    console.log(`[Runner] Starting task: ${title}`);
    
    try {
        // 1. Claim Task
        await updateStatus('In Progress');

        // 2. Sync Repo
        if (!repoPath || !fs.existsSync(repoPath)) {
            throw new Error(`Repo path invalid or missing: ${repoPath}`);
        }
        
        process.chdir(repoPath);
        console.log(`[Runner] Working in ${repoPath}`);

        // Ensure clean state
        execSync('git fetch origin main');
        execSync('git checkout main');
        execSync('git pull origin main --ff-only');

        // 3. Execute Work (Placeholder for Agent Logic Integration)
        // In a real run, this is where the agent Turn/Subagent logic would be called.
        // For the scaffold, we ensure the environment is ready.
        
        // 4. Preflight Checks
        console.log('[Runner] Running preflight (lint + test)...');
        try {
            // Check if scripts exist in package.json
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            if (pkg.scripts?.lint) execSync('npm run lint');
            if (pkg.scripts?.test) execSync('npm run test');
        } catch (err: any) {
            await updateStatus('Not Started', undefined, `Preflight failed: ${err.message}`);
            throw err;
        }

        // 5. Commit & Push
        console.log('[Runner] Committing and pushing...');
        execSync('git add .');
        // Check if there are changes to commit
        const status = execSync('git status --porcelain').toString();
        if (status) {
            execSync(`git commit -m "feat(auton): ${title} (Task: ${id})"`);
            execSync('git push origin main');
        }

        // 6. Deployment / Finalize
        // TODO: Integrate Dokploy deployment polling
        
        await updateStatus('Completed', `Task successfully executed and pushed to main.`);
        console.log(`[Runner] Task completed: ${title}`);

    } catch (error: any) {
        console.error(`[Runner] Task failed: ${title}`, error);
        // If not already blocked by preflight, mark as blocked
        await updateStatus('Not Started', undefined, error.message);
    }
}
