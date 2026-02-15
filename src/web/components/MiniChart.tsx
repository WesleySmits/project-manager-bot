import React from 'react';

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

export default function MiniChart({
    data,
    color = 'var(--accent)',
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

    const padding = { top: 12, right: 12, bottom: 24, left: 8 };
    const width = 320;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = data.map((d, i) => ({
        x: padding.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
        y: padding.top + chartH - ((d.value - min) / range) * chartH,
        date: d.date,
        value: d.value,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

    // Show first/last date labels
    const firstDate = data[0].date;
    const lastDate = data[data.length - 1].date;

    // Current / latest value
    const latest = data[data.length - 1];

    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                position: 'absolute', top: 0, right: 0,
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600,
                color: color, letterSpacing: '-0.02em',
            }}>
                {formatValue(latest.value)}
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
                {/* Area fill */}
                {showArea && (
                    <path d={areaPath} fill={color} opacity={0.08} />
                )}

                {/* Line */}
                <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

                {/* Dots */}
                {showDots && data.length <= 20 && points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} opacity={0.7}>
                        <title>{p.date}: {formatValue(p.value)}</title>
                    </circle>
                ))}

                {/* Date labels */}
                <text x={padding.left} y={height - 4} fontSize={9} fill="var(--text-tertiary)" fontFamily="var(--font-mono)">
                    {firstDate.slice(5)} {/* MM-DD */}
                </text>
                <text x={width - padding.right} y={height - 4} fontSize={9} fill="var(--text-tertiary)" fontFamily="var(--font-mono)" textAnchor="end">
                    {lastDate.slice(5)}
                </text>

                {/* Min/max reference lines */}
                <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top}
                    stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray="3,3" />
                <text x={padding.left} y={padding.top - 3} fontSize={8} fill="var(--text-tertiary)" fontFamily="var(--font-mono)">
                    {formatValue(max)}
                </text>
            </svg>
        </div>
    );
}
