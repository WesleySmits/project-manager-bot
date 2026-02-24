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
        <div className="login-page">
            <div className="card login-card fade-in">
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div className="mobile-brand" style={{ justifyContent: 'center', marginBottom: 16 }}>
                        <span className="brand-dot" /> Project Manager
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

                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 32 }}>
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: 44 }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
