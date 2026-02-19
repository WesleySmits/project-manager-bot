/**
 * Gemini AI Client for Strategic Advice
 */
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { StrategyAnalysis } from '../pm/strategy';
import { NotionPage, getTitle } from '../notion/client';

// Get API Key from env
const API_KEY: string | undefined = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
} else {
    console.warn('⚠️ GEMINI_API_KEY is missing. AI features will be disabled.');
}

interface TaskForInsight {
    title: string;
    priority?: string;
    projectRelationId?: string;
}

interface GoalForInsight {
    title: string;
}

/**
 * Generate improvement advice based on strategy analysis.
 */
export async function getStrategicAdvice(analysis: StrategyAnalysis): Promise<string> {
    if (!model) {
        throw new Error('Gemini API Key is missing. Please add GEMINI_API_KEY to .env');
    }

    const { metrics, issues, progress } = analysis;

    const context = {
        role: "You are an elite, no-nonsense Project Manager auditing a user's life operating system.",
        data: {
            active_projects: metrics.activeProjectsCount,
            project_limit: 5,
            stalled_goals: issues.stalledGoals.map((g: NotionPage) => getTitle(g)),
            zombie_projects: issues.zombieProjects.map((p: NotionPage) => getTitle(p)),
            goal_progress: progress.map(p => ({ goal: p.title, percent: p.percent })),
        },
        instructions: `
      Analyze the data above.
      1. Pick ONE critical area to improve immediately. PREFER fixing "Stalled Goals" or "Zombie Projects".
      2. If there are Stalled Goals (Goals with 0 active projects), explicitly suggest: "Let's fix [Goal Name]. You should attach a project to this."
      3. If there are Zombie Projects (Active but no tasks), suggest: "Project [Name] is dead. Archive it or plan tasks."
      4. Keep the output concise, conversational, and direct.
      5. Do not use markdown headers significantly, use bolding for emphasis.
      6. End with a concrete proposal: "Shall we create a project for [Goal]?"
    `,
    };

    try {
        const result = await model.generateContent(JSON.stringify(context));
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error('Gemini API Error:', err);
        throw new Error('Failed to generate advice from Gemini.');
    }
}

/**
 * Generate insights on how today's tasks contribute to life goals.
 */
export async function getTaskInsights(tasks: TaskForInsight[], goals: GoalForInsight[]): Promise<string> {
    if (!model) return '⚠️ AI insights unavailable (Key missing)';

    const context = {
        role: 'You are a wise and motivating productivity coach.',
        data: {
            tasks: tasks.map(t => ({
                title: t.title,
                priority: t.priority,
                projectRelationId: t.projectRelationId,
            })),
            goals: goals.map(g => ({ title: g.title })),
        },
        instructions: `
        Analyze how these specific tasks contribute to the user's life goals.
        1. Connect the dots between the tasks and the goals where possible.
        2. If a task seems unrelated to goals, mention it as a necessary maintenance or tactical step.
        3. Provide a coherent, 2-3 sentence paragraph explaining WHY these tasks are the right thing to focus on today.
        4. Be encouraging but grounded.
        5. Start directly with the insight, no "Here is the insight:" preamble.
        `,
    };

    try {
        const result = await model.generateContent(JSON.stringify(context));
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error('Gemini Insight Error:', err);
        return 'Could not generate insights at this time.';
    }
}

/**
 * Generate a motivational message about today's work impact.
 */
export async function generateMotivation(
    todayTasks: Array<{ title: string; id: string }>,
    goals: Array<{ title: string; progress: number }>,
    activeProjects: string[],
): Promise<string> {
    if (!model) return '⚠️ Motivation unavailable (Key missing)';

    const context = {
        role: 'You are a concise, energizing productivity coach. You speak directly and with conviction.',
        data: {
            todayTasks: todayTasks.map(t => t.title),
            goals: goals.map(g => ({ goal: g.title, progress: `${g.progress}%` })),
            activeProjects,
        },
        instructions: `
        The user is about to start their day. Based on the tasks scheduled today and their life goals:
        1. Explain in 2-3 sentences how today's tasks move the needle on their goals.
        2. Pick the single most impactful task and explain WHY it matters for their life trajectory.
        3. End with one powerful motivating sentence.
        4. Be specific — reference actual task names and goal names.
        5. Keep it under 100 words total. No markdown headers, just flowing text with bold for emphasis.
        `,
    };

    try {
        const result = await model.generateContent(JSON.stringify(context));
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error('Gemini Motivation Error:', err);
        return 'Could not generate motivation at this time.';
    }
}
