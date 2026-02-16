import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const COOKIE_NAME = 'auth_token';

/**
 * JWT Authentication Middleware
 * Protects routes by verifying the HTTP-only cookie
 */
export const jwtAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for login/public routes (handled in index.ts via route ordering usually, but good safeguard)
    if (req.path.startsWith('/api/auth')) {
        next();
        return;
    }

    // Skip auth in development IF strictly requested, but session auth is usually better to keep consistent
    if (process.env.NODE_ENV === 'development') {
        // Option: allow dev to skip? For now, let's enforce it to test the flow.
        // next(); return;
    }

    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
        // If API request, return 401
        if (req.path.startsWith('/api')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // If Frontend request (document), redirect to Login
        // Note: In an SPA, we might typically serve the index.html and let React handle the redirect.
        // But for strict protection, we can redirect here OR let the SPA handle 401s.
        // Let's pass through for non-API requests (static files/SPA) so the frontend can load and handle the redirect.
        next();
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (req as any).user = decoded;
        next();
    } catch (err) {
        if (req.path.startsWith('/api')) {
            res.status(401).json({ error: 'Invalid token' });
        } else {
            next(); // Let frontend handle invalid session
        }
    }
};
