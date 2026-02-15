"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequest = createRequest;
exports.updateRequestStatus = updateRequestStatus;
exports.getRequest = getRequest;
/**
 * Approval Manager
 * Handles pending approval requests in a local JSON file
 */
const fs_1 = require("fs");
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const PENDING_FILE = path.join(__dirname, '../../data/pm_pending.json');
// Simple UUID generator fallback
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
}
// Ensure data file exists
async function initStore() {
    try {
        await fs_1.promises.access(PENDING_FILE);
    }
    catch {
        // Ensure directory exists first
        await fs_1.promises.mkdir(path.dirname(PENDING_FILE), { recursive: true });
        await fs_1.promises.writeFile(PENDING_FILE, JSON.stringify({}, null, 2));
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
    const file = await fs_1.promises.readFile(PENDING_FILE, 'utf8');
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
    await fs_1.promises.writeFile(PENDING_FILE, JSON.stringify(data, null, 2));
    return id;
}
/**
 * Update request status (Approve/Reject)
 */
async function updateRequestStatus(id, status, resolverId) {
    await initStore();
    const file = await fs_1.promises.readFile(PENDING_FILE, 'utf8');
    const data = JSON.parse(file || '{}');
    if (!data[id])
        throw new Error('Request not found');
    if (data[id].status !== 'PENDING')
        throw new Error(`Request already ${data[id].status}`);
    data[id].status = status;
    data[id].resolvedAt = new Date().toISOString();
    data[id].resolverId = resolverId;
    await fs_1.promises.writeFile(PENDING_FILE, JSON.stringify(data, null, 2));
    return data[id];
}
/**
 * Get request by ID
 */
async function getRequest(id) {
    await initStore();
    const file = await fs_1.promises.readFile(PENDING_FILE, 'utf8');
    const data = JSON.parse(file || '{}');
    return data[id];
}
