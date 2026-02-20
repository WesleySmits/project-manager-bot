import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
    { to: '/', label: 'Dashboard', icon: '◆' },
    { to: '/tasks', label: 'Tasks', icon: '☰' },
    { to: '/projects', label: 'Projects', icon: '▣' },
    { to: '/goals', label: 'Goals', icon: '◎' },
];

const analysisItems = [
    { to: '/health', label: 'Health', icon: '♡' },
    { to: '/insights', label: 'Insights', icon: '✦' },
    { to: '/analytics', label: 'Analytics', icon: '📈' },
    { to: '/weekly-review', label: 'Weekly Review', icon: '📋' },
];

const personalItems = [
    { to: '/body', label: 'Body', icon: '💪' },
    { to: '/health-data', label: 'Raw Exports', icon: '💾' },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    return (
        <>
            <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <span className="brand-dot" />
                    PM
                </div>
                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Navigate</div>
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) => isActive ? 'active' : ''}
                            onClick={onClose}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}

                    <div className="sidebar-section-label">Analysis</div>
                    {analysisItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => isActive ? 'active' : ''}
                            onClick={onClose}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}

                    <div className="sidebar-section-label">Personal</div>
                    {personalItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => isActive ? 'active' : ''}
                            onClick={onClose}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>
        </>
    );
}
