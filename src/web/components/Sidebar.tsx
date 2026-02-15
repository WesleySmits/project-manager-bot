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
];

export default function Sidebar() {
    return (
        <aside className="sidebar">
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
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
