/**
 * Approval Manager
 * Handles pending approval requests in a local JSON file
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const PENDING_FILE = path.join(__dirname, '../../data/pm_pending.json');

export interface ApprovalRequest {
    id: string;
    type: string;
    payload: any;
    requesterId: string | number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    resolvedAt?: string;
    resolverId?: string | number;
}

// Simple UUID generator fallback
function generateId(): string {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
}

// Ensure data file exists
async function initStore(): Promise<void> {
    try {
        await fs.access(PENDING_FILE);
    } catch {
        // Ensure directory exists first
        await fs.mkdir(path.dirname(PENDING_FILE), { recursive: true });
        await fs.writeFile(PENDING_FILE, JSON.stringify({}, null, 2));
    }
}

/**
 * Create a new pending request
 * @param {string} type - 'CREATE_TASK', 'UPDATE_TASK', 'REMINDER'
 * @param {Object} payload - Data for the action
 * @param {string} requesterId - Telegram User ID
 */
export async function createRequest(type: string, payload: any, requesterId: string | number): Promise<string> {
    await initStore();
    const file = await fs.readFile(PENDING_FILE, 'utf8');
    const data: Record<string, ApprovalRequest> = JSON.parse(file || '{}');

    const id = generateId();
    data[id] = {
        id,
        type,
        payload,
        requesterId,
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };

    await fs.writeFile(PENDING_FILE, JSON.stringify(data, null, 2));
    return id;
}

/**
 * Update request status (Approve/Reject)
 */
export async function updateRequestStatus(id: string, status: 'APPROVED' | 'REJECTED', resolverId: string | number): Promise<ApprovalRequest> {
    await initStore();
    const file = await fs.readFile(PENDING_FILE, 'utf8');
    const data: Record<string, ApprovalRequest> = JSON.parse(file || '{}');

    if (!data[id]) throw new Error('Request not found');
    if (data[id].status !== 'PENDING') throw new Error(`Request already ${data[id].status}`);

    data[id].status = status;
    data[id].resolvedAt = new Date().toISOString();
    data[id].resolverId = resolverId;

    await fs.writeFile(PENDING_FILE, JSON.stringify(data, null, 2));
    return data[id];
}

/**
 * Get request by ID
 */
export async function getRequest(id: string): Promise<ApprovalRequest | undefined> {
    await initStore();
    const file = await fs.readFile(PENDING_FILE, 'utf8');
    const data: Record<string, ApprovalRequest> = JSON.parse(file || '{}');
    return data[id];
}
