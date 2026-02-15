import React, { useEffect, useState } from 'react';
import { api, HealthExportMeta } from '../client';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

/** Recursively summarize the shape of a JSON value */
function describeShape(value: unknown, depth = 0): React.ReactNode {
    if (depth > 3) return <span style={{ color: 'var(--text-tertiary)' }}>…</span>;
    if (value === null) return <span className="badge low">null</span>;
    if (Array.isArray(value)) {
        return (
            <span>
                <span className="badge low">array[{value.length}]</span>
                {value.length > 0 && depth < 3 && (
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 12 }}>
                        items: {describeShape(value[0], depth + 1)}
                    </span>
                )}
            </span>
        );
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value as Record<string, unknown>);
        return (
            <span>
                <span className="badge low">object</span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 12 }}>
                    ({keys.length} keys)
                </span>
            </span>
        );
    }
    return <span className="badge low">{typeof value}</span>;
}

export default function HealthData() {
    const [exports, setExports] = useState<HealthExportMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);
    const [detail, setDetail] = useState<unknown>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        api.healthExports()
            .then(d => { setExports(d.exports); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleSelect = async (filename: string) => {
        if (selected === filename) {
            setSelected(null);
            setDetail(null);
            return;
        }
        setSelected(filename);
        setDetailLoading(true);
        try {
            const data = await api.healthExport(filename);
            setDetail(data);
        } catch {
            setDetail({ error: 'Failed to load export' });
        }
        setDetailLoading(false);
    };

    if (loading) return <div className="loading-state"><span className="spinner" /> Loading health exports…</div>;

    return (
        <>
            <header className="page-header"><h1>Health Data</h1></header>
            <div className="page-body">

                {/* Summary */}
                <div className="metrics-grid fade-in">
                    <div className="metric-card">
                        <div className="metric-label">Total Exports</div>
                        <div className="metric-value">{exports.length}</div>
                    </div>
                    {exports.length > 0 && (
                        <>
                            <div className="metric-card">
                                <div className="metric-label">Latest</div>
                                <div className="metric-value" style={{ fontSize: 16 }}>
                                    {formatDate(exports[0].date)}
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Total Size</div>
                                <div className="metric-value" style={{ fontSize: 16 }}>
                                    {formatBytes(exports.reduce((s, e) => s + e.sizeBytes, 0))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {exports.length === 0 ? (
                    <div className="empty-state fade-in" style={{ marginTop: 24 }}>
                        <p style={{ fontSize: 18, marginBottom: 8 }}>No health exports yet</p>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
                            Send data via POST to <code>/api/health-data</code> from Apple Health Auto Export
                        </p>
                    </div>
                ) : (
                    <div className="section fade-in" style={{ marginTop: 16 }}>
                        <div className="section-title">Exports</div>
                        <div className="card">
                            <div className="card-body no-pad">
                                <div className="issue-list">
                                    {exports.map(exp => (
                                        <div key={exp.filename}>
                                            <div
                                                className="issue-item"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleSelect(exp.filename)}
                                            >
                                                <span
                                                    className="issue-dot"
                                                    style={{ background: selected === exp.filename ? 'var(--accent)' : 'var(--text-tertiary)' }}
                                                />
                                                <span style={{ flex: 1 }}>{formatDate(exp.date)}</span>
                                                <span className="badge low" style={{ marginLeft: 8 }}>
                                                    {formatBytes(exp.sizeBytes)}
                                                </span>
                                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                                                    {selected === exp.filename ? '▼' : '▶'}
                                                </span>
                                            </div>

                                            {selected === exp.filename && (
                                                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                                                    {detailLoading ? (
                                                        <div className="loading-state"><span className="spinner" /> Loading…</div>
                                                    ) : detail ? (
                                                        <>
                                                            {/* Shape summary */}
                                                            <div style={{ marginBottom: 12 }}>
                                                                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                                                                    Data Shape (top-level keys)
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                    {typeof detail === 'object' && detail !== null && !Array.isArray(detail) ? (
                                                                        Object.entries(detail as Record<string, unknown>).map(([key, val]) => (
                                                                            <div key={key} style={{
                                                                                display: 'flex', alignItems: 'center', gap: 8,
                                                                                fontFamily: 'var(--font-mono)', fontSize: 13
                                                                            }}>
                                                                                <span style={{ color: 'var(--accent)', minWidth: 140 }}>{key}</span>
                                                                                {describeShape(val)}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div>{describeShape(detail)}</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Raw JSON */}
                                                            <details>
                                                                <summary style={{
                                                                    cursor: 'pointer', fontSize: 13,
                                                                    color: 'var(--text-secondary)', marginBottom: 8
                                                                }}>
                                                                    Raw JSON
                                                                </summary>
                                                                <pre style={{
                                                                    background: 'var(--bg-secondary)',
                                                                    padding: 12,
                                                                    borderRadius: 8,
                                                                    overflow: 'auto',
                                                                    maxHeight: 400,
                                                                    fontSize: 12,
                                                                    fontFamily: 'var(--font-mono)',
                                                                    whiteSpace: 'pre-wrap',
                                                                    wordBreak: 'break-word',
                                                                }}>
                                                                    {JSON.stringify(detail, null, 2)}
                                                                </pre>
                                                            </details>
                                                        </>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
