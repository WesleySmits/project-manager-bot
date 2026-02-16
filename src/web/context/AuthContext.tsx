import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, UnauthorizedError } from '../client';

interface AuthContextType {
    user: { username: string } | null;
    isLoading: boolean;
    login: (u: string, p: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<{ username: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.me()
            .then(data => {
                if (data.authenticated && data.user) {
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            })
            .catch(err => {
                // If 401 or network error, assume not logged in
                setUser(null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const login = async (u: string, p: string) => {
        const res = await api.login(u, p);
        if (res.success) {
            setUser(res.user);
        }
    };

    const logout = async () => {
        await api.logout();
        setUser(null);
        // Force reload to clear any other state/cache
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth()!;

    if (isLoading) return <div className="loading-state">Loading...</div>;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
