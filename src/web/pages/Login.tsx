import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const { login } = useAuth()!;
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Invalid credentials');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
        }}>
            <div className="card fade-in" style={{ width: 320, padding: 24 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div className="mobile-brand" style={{ justifyContent: 'center', marginBottom: 16 }}>
                        <span className="brand-dot" /> PM
                    </div>
                    <h2 style={{ fontSize: 20, margin: 0 }}>Welcome Back</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
                        Sign in to manage your projects
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{
                            padding: '8px 12px', borderRadius: 6,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--red)', fontSize: 13, marginBottom: 16
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
