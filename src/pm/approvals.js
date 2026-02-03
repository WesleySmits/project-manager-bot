/**
 * Approval Manager
 * Handles pending approval requests in a local JSON file
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const PENDING_FILE = path.join(__dirname, '../../data/pm_pending.json');

// Simple UUID generator fallback
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
}

// Ensure data file exists
async function initStore() {
    try {
        await fs.access(PENDING_FILE);
    } catch {
        await fs.writeFile(PENDING_FILE, JSON.stringify({}, null, 2));
    }
}

/**
 * Create a new pending request
 * @param {string} type - 'CREATE_TASK', 'UPDATE_TASK', 'REMINDER'
 * @param {Object} payload - Data for the action
 * @param {string} requesterId - Telegram User ID
 */
async function createRequest(type, payload, requesterId) {
    await initStore();
    const file = await fs.readFile(PENDING_FILE, 'utf8');
    const data = JSON.parse(file || '{}');

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
async function updateRequestStatus(id, status, resolverId) {
    await initStore();
    const file = await fs.readFile(PENDING_FILE, 'utf8');
    const data = JSON.parse(file || '{}');

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
async function getRequest(id) {
    await initStore();
    const file = await fs.readFile(PENDING_FILE, 'utf8');
    const data = JSON.parse(file || '{}');
    return data[id];
}

module.exports = {
    createRequest,
    updateRequestStatus,
    getRequest
};
