import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';
import Goals from './pages/Goals';
import Health from './pages/Health';
import Insights from './pages/Insights';
import HealthData from './pages/HealthData';
import HealthDashboard from './pages/HealthDashboard';
import Login from './pages/Login';
import Analytics from './pages/Analytics';
import { AuthProvider, RequireAuth } from './context/AuthContext';
import { prefetchAll } from './client';

function ProtectedLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => { prefetchAll(); }, []);

    return (
        <div className="app-layout">
            <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<Login />} />

                <Route element={
                    <RequireAuth>
                        <ProtectedLayout />
                    </RequireAuth>
                }>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/goals" element={<Goals />} />
                    <Route path="/health" element={<Health />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/body" element={<HealthDashboard />} />
                    <Route path="/health-data" element={<HealthData />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    );
}
