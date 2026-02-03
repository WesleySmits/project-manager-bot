/**
 * Gemini AI Client for Strategic Advice
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Get API Key from env
const API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;
let model = null;

if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    // Fallback to Flash if Pro is unavailable, or use 'gemini-pro' (v1.0)
    // User asked for "Pro 3" (likely meaning the latest Pro or Flash)
    model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
} else {
    console.warn('⚠️ GEMINI_API_KEY is missing. AI features will be disabled.');
}

/**
 * Generate improvement advice based on strategy analysis
 * @param {Object} analysis - The JSON output from strategy.js
 */
async function getStrategicAdvice(analysis) {
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
            stalled_goals: issues.stalledGoals.map(g => g.properties?.Name?.title?.[0]?.plain_text || 'Untitled'),
            zombie_projects: issues.zombieProjects.map(p => p.properties?.['Project name']?.title?.[0]?.plain_text || 'Untitled'),
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

module.exports = {
    getStrategicAdvice
};
