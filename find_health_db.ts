
require('dotenv').config();
import { search } from './src/notion/client';

async function main() {
    console.log('Searching for "Health" databases...');
    try {
        const results = await search('Health', 20);
        const dbs = results.filter(r => r.object === 'database');

        console.log(`Found ${dbs.length} databases.`);
        for (const db of dbs) {
            const title = db.title?.[0]?.plain_text || 'Untitled';
            console.log(`- [${db.id}] ${title}`);
            // Log properties to see if it's relevant
            console.log('  Properties:', Object.keys(db.properties).join(', '));
        }

        if (dbs.length === 0) {
            console.log('No "Health" databases found.');
            // Search validation - verify token works
            const all = await search('', 1);
            console.log(`Token verification: Found ${all.length} items total.`);
        }
    } catch (e) {
        console.error('Search failed:', e);
    }
}

main();
