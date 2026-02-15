import React from 'react';
import { Line } from 'react-chartjs-2';
import { ScriptableContext } from 'chart.js';

interface DataPoint {
    date: string;
    value: number;
}

interface MiniChartProps {
    data: DataPoint[];
    color?: string;
    height?: number;
    showDots?: boolean;
    showArea?: boolean;
    formatValue?: (v: number) => string;
}

/** Convert hex to rgba with alpha */
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function MiniChart({
    data,
    color = '#818cf8',
    height = 120,
    showDots = true,
    showArea = true,
    formatValue = v => v.toFixed(1),
}: MiniChartProps) {
    if (data.length === 0) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                No data
            </div>
        );
    }

    const chartData = {
        labels: data.map(d => d.date.slice(5)), // MM-DD
        datasets: [
            {
                label: 'Value',
                data: data.map(d => d.value),
                borderColor: color,
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    if (!showArea) return 'transparent';
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, height);
                    // Use helper if hex, otherwise fallback to simple string
                    const startColor = color.startsWith('#') ? hexToRgba(color, 0.5) : color;
                    const endColor = color.startsWith('#') ? hexToRgba(color, 0.0) : 'transparent';

                    gradient.addColorStop(0, startColor);
                    gradient.addColorStop(1, endColor);
                    return gradient;
                },
                fill: showArea ? {
                    target: 'origin',
                    above: color.startsWith('#') ? hexToRgba(color, 0.1) : color,
                } : false,
                borderWidth: 2,
                pointRadius: showDots ? 3 : 0,
                pointHoverRadius: 6,
                pointBackgroundColor: color,
                pointBorderColor: 'var(--bg-base)', // Chart.js can't parse var() easily on canvas, but pointBorderColor *might* work if passed as string result?
                // Actually context strokeStyle does support CSS variables in some browsers. But to be safe let's use the dark bg hex: #0a0a0b
                pointBorderWidth: 2,
                tension: 0.4,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#18181b',
                titleColor: '#fafafa',
                bodyColor: '#a1a1aa',
                borderColor: '#27272a',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                    label: (context: any) => formatValue(context.parsed.y),
                },
            },
        },
        scales: {
            x: {
                display: true,
                grid: { display: false, drawBorder: false },
                ticks: {
                    color: '#52525b',
                    font: { size: 10, family: '"JetBrains Mono", monospace' },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 6,
                },
                border: { display: false },
            },
            y: {
                display: false,
                min: Math.min(...data.map(d => d.value)) * 0.95,
                max: Math.max(...data.map(d => d.value)) * 1.05,
            },
        },
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
    };

    return (
        <div style={{ height, width: '100%', position: 'relative' }}>
            <div style={{
                position: 'absolute', top: -46, right: 0,
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600,
                color: color, letterSpacing: '-0.02em', pointerEvents: 'none'
            }}>
                {formatValue(data[data.length - 1].value)}
            </div>
            <Line data={chartData} options={options} />
        </div>
    );
}
