import { Request, Response, NextFunction } from 'express';

/**
 * API key authentication middleware.
 *
 * Designed for machine-to-machine callers (e.g. Openclaw) that cannot use
 * cookie-based JWT sessions.
 *
 * Usage: set API_KEY in your environment and send it on every request as:
 *   Authorization: Bearer <key>   (preferred)
 *   X-API-Key: <key>              (alternative)
 *
 * Routes that accept API key auth are registered in index.ts *before*
 * jwtAuthMiddleware, so the two schemes are independent.
 */
export const apiKeyAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const API_KEY = process.env.API_KEY;

    if (!API_KEY) {
        // Feature is disabled — do not block, let JWT middleware decide.
        next();
        return;
    }

    // Extract key from Authorization header or X-API-Key header
    const authHeader = req.headers['authorization'];
    const xApiKey = req.headers['x-api-key'];

    let providedKey: string | undefined;

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        providedKey = authHeader.slice(7);
    } else if (typeof xApiKey === 'string') {
        providedKey = xApiKey;
    }

        const RUNNER_TOKEN = process.env.RUNNER_TOKEN;
    if (providedKey && (providedKey === API_KEY || (RUNNER_TOKEN && providedKey === RUNNER_TOKEN))) {
        // Mark the request as authenticated via API key so downstream
        // middleware / routes know the identity.
        (req as Request & { apiKeyAuthenticated: boolean }).apiKeyAuthenticated = true;
        next();
        return;
    }

    console.log(`[Auth-Audit] Failed API Key attempt on ${req.path}. Header keys seen: ${Object.keys(req.headers).join(", ")}`);

    // Key missing or wrong — fall through to JWT middleware instead of
    // immediately rejecting, so a valid JWT cookie still works on the same routes.
    next();
};

/**
 * Require that the request was authenticated by either the API key middleware
 * OR the JWT middleware.  Use this on routes that should be accessible by both
 * browser sessions and machine callers.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const hasApiKey = (req as Request & { apiKeyAuthenticated?: boolean }).apiKeyAuthenticated === true;
    const hasJwt = (req as Request & { user?: unknown }).user !== undefined;

    if (hasApiKey || hasJwt) {
        next();
        return;
    }

    res.status(401).json({ error: 'Unauthorized' });
};
