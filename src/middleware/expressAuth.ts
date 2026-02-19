import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

// JWT_SECRET is guaranteed non-empty by startup validation in index.ts
const JWT_SECRET = process.env.JWT_SECRET as string;
const COOKIE_NAME = 'auth_token';

interface AuthenticatedRequest extends Request {
    user?: JwtPayload | string;
}

/**
 * JWT Authentication Middleware
 * Protects routes by verifying the HTTP-only cookie.
 * Runs after apiKeyAuthMiddleware — if the API key already authenticated
 * the request, this middleware is effectively a no-op for that request.
 */
export const jwtAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Skip auth for public routes
    if (req.path.startsWith('/api/auth') || req.path === '/api/health') {
        next();
        return;
    }

    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
        if (req.path.startsWith('/api')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Non-API request (SPA static files) — let React handle the redirect
        next();
        return;
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        if (req.path.startsWith('/api')) {
            res.status(401).json({ error: 'Invalid token' });
        } else {
            next();
        }
    }
};
