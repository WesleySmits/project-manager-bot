import React from 'react';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
    return (
        <header className="mobile-header">
            <div className="mobile-brand">
                <span className="brand-dot" />
                PM
            </div>
            <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
                ☰
            </button>
        </header>
    );
}
