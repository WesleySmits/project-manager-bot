
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
    try {
        console.log('Fetching available models...');
        // Note: listModels is a method on the GoogleGenerativeAI instance (or GenAIFileManager depending on version,
        // but typically available via API if supported by the SDK version used).
        // Actually, in @google/generative-ai, it might be via the ModelManager or simply not directly exposed in high-level client
        // effectively without using the specific API endpoint manually or a specific manager.
        // Let's try the generic way if the SDK exposes it, otherwise we might need to use the `fetc`h approach if the SDK version is limited.

        // Checking SDK documentation pattern:
        // The error message "Call ListModels to see the list of available models" suggests it's an API capability.
        // In the Node SDK, it's often `genAI.getGenerativeModel` but listing might be separate.
        // Let's try to infer if there's a manager or if we should just hit the REST endpoint for listing.

        // Standard endpoint: https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Available Models:');
        if (data.models) {
            data.models.forEach((m: any) => {
                console.log(`- ${m.name} (${m.displayName}) - Supported methods: ${m.supportedGenerationMethods.join(', ')}`);
            });
        } else {
            console.log('No models found in response.');
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('Error fetching models:', error);
    }
}

listModels();
