import { NotionPage } from './client';
import { Temporal } from '@js-temporal/polyfill';

const today = Temporal.Now.plainDateISO();
const yesterday = today.subtract({ days: 1 });
const tomorrow = today.add({ days: 1 });
const nextWeek = today.add({ days: 7 });

export const MOCK_GOALS: NotionPage[] = [
    {
        id: 'goal-1',
        url: 'https://notion.so/goal-1',
        created_time: yesterday.toString(),
        last_edited_time: yesterday.toString(),
        properties: {
            'Name': { type: 'title', title: [{ plain_text: '🚀 Launch Project Manager Bot' }] },
            'Status': { type: 'status', status: { name: 'In Progress' } },
            'Description': { type: 'rich_text', rich_text: [{ plain_text: 'Complete all features for the initial release.' }] }
        }
    },
    {
        id: 'goal-2',
        url: 'https://notion.so/goal-2',
        created_time: '2026-01-01',
        last_edited_time: '2026-01-01',
        properties: {
            'Name': { type: 'title', title: [{ plain_text: '🧘 Maintain Physical Health' }] },
            'Status': { type: 'status', status: { name: 'Ongoing' } },
            'Description': { type: 'rich_text', rich_text: [{ plain_text: 'Stick to daily exercise and sleep targets.' }] }
        }
    }
];

export const MOCK_PROJECTS: NotionPage[] = [
    {
        id: 'proj-1',
        url: 'https://notion.so/proj-1',
        created_time: yesterday.toString(),
        last_edited_time: yesterday.toString(),
        properties: {
            'Name': { type: 'title', title: [{ plain_text: '🤖 Bot Core Development' }] },
            'Status': { type: 'status', status: { name: 'In Progress' } },
            'Goal': { type: 'relation', relation: [{ id: 'goal-1' }] },
            'Description': { type: 'rich_text', rich_text: [{ plain_text: 'Backend and Telegram integration.' }] }
        }
    },
    {
        id: 'proj-2',
        url: 'https://notion.so/proj-2',
        created_time: '2026-01-01',
        last_edited_time: '2026-01-01',
        properties: {
            'Name': { type: 'title', title: [{ plain_text: '🌐 Web Dashboard' }] },
            'Status': { type: 'status', status: { name: 'Planning' } },
            'Goal': { type: 'relation', relation: [{ id: 'goal-1' }] },
            'Description': { type: 'rich_text', rich_text: [{ plain_text: 'React-based interface for managing tasks.' }] }
        }
    }
];

export const MOCK_TASKS: NotionPage[] = [
    {
        id: 'task-1',
        url: 'https://notion.so/task-1',
        created_time: yesterday.toString(),
        last_edited_time: yesterday.toString(),
        properties: {
            'Name': { type: 'title', title: [{ plain_text: 'Implement Rate Limiting' }] },
            'Status': { type: 'status', status: { name: 'In Progress' } },
            'Priority': { type: 'select', select: { name: 'High' } },
            'Project': { type: 'relation', relation: [{ id: 'proj-1' }] },
            'Due Date': { type: 'date', date: { start: today.toString(), end: null } },
            'ID': { type: 'number', number: 101 }
        }
    },
    {
        id: 'task-2',
        url: 'https://notion.so/task-2',
        created_time: yesterday.toString(),
        last_edited_time: yesterday.toString(),
        properties: {
            'Name': { type: 'title', title: [{ plain_text: 'Write Documentation' }] },
            'Status': { type: 'status', status: { name: 'Todo' } },
            'Priority': { type: 'select', select: { name: 'Medium' } },
            'Project': { type: 'relation', relation: [{ id: 'proj-1' }] },
            'Scheduled': { type: 'date', date: { start: tomorrow.toString(), end: null } },
            'ID': { type: 'number', number: 102 }
        }
    },
    {
        id: 'task-3',
        url: 'https://notion.so/task-3',
        created_time: yesterday.toString(),
        last_edited_time: yesterday.toString(),
        properties: {
            'Name': { type: 'title', title: [{ plain_text: 'Fix Type Errors' }] },
            'Status': { type: 'status', status: { name: 'Done' } },
            'Priority': { type: 'select', select: { name: 'High' } },
            'Completed Date': { type: 'date', date: { start: yesterday.toString(), end: null } },
            'Project': { type: 'relation', relation: [{ id: 'proj-1' }] },
            'ID': { type: 'number', number: 103 }
        }
    },
    {
        id: 'task-4',
        url: 'https://notion.so/task-4',
        created_time: yesterday.toString(),
        last_edited_time: yesterday.toString(),
        properties: {
            'Name': { type: 'title', title: [{ plain_text: 'Setup React Query' }] },
            'Status': { type: 'status', status: { name: 'Todo' } },
            'Priority': { type: 'select', select: { name: 'Low' } },
            'Project': { type: 'relation', relation: [{ id: 'proj-2' }] },
            'ID': { type: 'number', number: 104 }
        }
    },
    {
        id: 'task-5',
        url: 'https://notion.so/task-5',
        created_time: yesterday.toString(),
        last_edited_time: yesterday.toString(),
        properties: {
            'Name': { type: 'title', title: [{ plain_text: 'Buy Groceries' }] },
            'Status': { type: 'status', status: { name: 'Todo' } },
            'Priority': { type: 'select', select: { name: 'Medium' } },
            'Due Date': { type: 'date', date: { start: yesterday.toString(), end: null } }, // Overdue
            'ID': { type: 'number', number: 105 }
        }
    }
];

export const MOCK_HEALTH_METRICS = {
    metrics: [
        {
            name: 'step_count',
            units: 'count',
            data: [
                { date: yesterday.toString() + ' 23:59:59', qty: 8500 },
                { date: today.toString() + ' 12:00:00', qty: 4200 }
            ]
        },
        {
            name: 'active_energy',
            units: 'kcal',
            data: [
                { date: yesterday.toString() + ' 23:59:59', qty: 450 },
                { date: today.toString() + ' 12:00:00', qty: 210 }
            ]
        },
        {
            name: 'sleep_analysis',
            units: 'hr',
            data: [
                {
                    date: today.toString() + ' 07:00:00',
                    totalSleep: 7.5,
                    deep: 1.5,
                    core: 4.5,
                    rem: 1.5,
                    awake: 0.2
                }
            ]
        },
        {
            name: 'weight_body_mass',
            units: 'kg',
            data: [
                { date: today.toString() + ' 08:00:00', qty: 75.5 }
            ]
        }
    ]
};
