/**
 * Gemini AI Client for Strategic Advice
 */
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Get API Key from env
const API_KEY: string | undefined = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    // Fallback to Flash if Pro is unavailable, or use 'gemini-pro' (v1.0)
    // User asked for "Pro 3" (likely meaning the latest Pro or Flash)
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
} else {
    console.warn('⚠️ GEMINI_API_KEY is missing. AI features will be disabled.');
}

interface StrategyAnalysis {
    metrics: {
        activeProjectsCount: number;
    };
    issues: {
        stalledGoals: any[]; // Define more specific Notion types if possible
        zombieProjects: any[];
    };
    progress: {
        title: string;
        percent: number;
    }[];
}

interface Task {
    title: string;
    priority?: string;
    properties?: any; // Define Notion property types
}

interface Goal {
    properties?: any; // Define Notion property types
}

/**
 * Generate improvement advice based on strategy analysis
 * @param {StrategyAnalysis} analysis - The JSON output from strategy.js
 */
export async function getStrategicAdvice(analysis: StrategyAnalysis): Promise<string> {
    if (!model) {
        throw new Error('Gemini API Key is missing. Please add GEMINI_API_KEY to .env');
    }

    const { metrics, issues, progress } = analysis;

    // Prepare context for the LLM
    const context = {
        role: "You are an elite, no-nonsense Project Manager auditing a user's life operating system.",
        data: {
            active_projects: metrics.activeProjectsCount,
            project_limit: 5,
            stalled_goals: issues.stalledGoals.map((g: any) => g.properties?.Name?.title?.[0]?.plain_text || 'Untitled'),
            zombie_projects: issues.zombieProjects.map((p: any) => p.properties?.['Project name']?.title?.[0]?.plain_text || 'Untitled'),
            goal_progress: progress.map(p => ({ goal: p.title, percent: p.percent }))
        },
        instructions: `
      Analyze the data above.
      1. Pick ONE critical area to improve immediately. PREFER fixing "Stalled Goals" or "Zombie Projects".
      2. If there are Stalled Goals (Goals with 0 active projects), explicitly suggest: "Let's fix [Goal Name]. You should attach a project to this."
      3. If there are Zombie Projects (Active but no tasks), suggest: "Project [Name] is dead. Archive it or plan tasks."
      4. Keep the output concise, conversational, and direct.
      5. Do not use markdown headers significantly, use bolding for emphasis.
      6. End with a concrete proposal: "Shall we create a project for [Goal]?"
    `
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
 * Generate insights on how today's tasks contribute to life goals
 * @param {Task[]} tasks - List of today's tasks
 * @param {Goal[]} goals - List of active goals
 * @returns {Promise<string>} AI-generated insight text
 */
export async function getTaskInsights(tasks: Task[], goals: Goal[]): Promise<string> {
    if (!model) return "⚠️ AI insights unavailable (Key missing)";

    const context = {
        role: "You are a wise and motivating productivity coach.",
        data: {
            tasks: tasks.map(t => ({
                title: t.title,
                priority: t.priority,
                project: t.properties?.Project?.relation?.[0]?.id // We might not have project name resolved here easily without extra fetching, but let's try to rely on Title/Context
            })),
            goals: goals.map(g => ({
                title: g.properties?.Name?.title?.[0]?.plain_text || 'Untitled'
            }))
        },
        instructions: `
        Analyze how these specific tasks contribute to the user's life goals.
        1. Connect the dots between the tasks and the goals where possible.
        2. If a task seems unrelated to goals, mention it as a necessary maintenance or tactical step.
        3. Provide a coherent, 2-3 sentence paragraph explaining WHY these tasks are the right thing to focus on today.
        4. Be encouraging but grounded.
        5. Start directly with the insight, no "Here is the insight:" preamble.
        `
    };

    try {
        const result = await model.generateContent(JSON.stringify(context));
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error('Gemini Insight Error:', err);
        return "Could not generate insights at this time.";
    }
}
