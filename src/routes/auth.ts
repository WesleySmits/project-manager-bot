import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
const COOKIE_NAME = 'auth_token';
const IS_PROD = process.env.NODE_ENV === 'production';

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const ENV_USER = process.env.BASIC_AUTH_USER;
    const ENV_PASS = process.env.BASIC_AUTH_PASS;

    if (!ENV_USER || !ENV_PASS) {
        console.error('Auth env vars not set!');
        res.status(500).json({ error: 'Server misconfiguration' });
        return;
    }

    if (username === ENV_USER && password === ENV_PASS) {
        // Sign token
        const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '7d' });

        // Set cookie
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ success: true, user: { username } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
});

router.get('/me', (req, res) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
        res.status(401).json({ authenticated: false });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        res.json({ authenticated: true, user: decoded.user });
    } catch (err) {
        res.clearCookie(COOKIE_NAME);
        res.status(401).json({ authenticated: false });
    }
});

export default router;
