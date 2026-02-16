import { Request, Response, NextFunction } from 'express';

/**
 * Basic Authentication Middleware for Express
 * Protects all routes by requiring a username and password
 */
export const basicAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Skip auth in development mode
    if (process.env.NODE_ENV === 'development') {
        next();
        return;
    }

    const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER;
    const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS;

    // Parse the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Project Manager"');
        res.status(401).send('Authentication required');
        return;
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Project Manager"');
        res.status(401).send('Invalid credentials');
    }
};
