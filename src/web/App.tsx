import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import { prefetchAll } from './client';

export default function App() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => { prefetchAll(); }, []);

    return (
        <div className="app-layout">
            <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/goals" element={<Goals />} />
                    <Route path="/health" element={<Health />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/body" element={<HealthDashboard />} />
                    <Route path="/health-data" element={<HealthData />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}
