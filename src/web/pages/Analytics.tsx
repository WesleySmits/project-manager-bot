import React, { useEffect, useState } from 'react';
import { api, AnalyticsSnapshot } from '../client';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function Analytics() {
    const [summary, setSummary] = useState<AnalyticsSnapshot | null>(null);
    const [history, setHistory] = useState<AnalyticsSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [s, h] = await Promise.all([
                api.analytics.summary(),
                api.analytics.history()
            ]);
            setSummary(s);
            setHistory(h);
        } catch (e) {
            console.error('Failed to load analytics', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const newSnapshot = await api.analytics.refresh();
            setSummary(newSnapshot);
            // Reload history too as it might have updated if we fixed a gap
            const h = await api.analytics.history();
            setHistory(h);
        } catch (e) {
            console.error('Failed to refresh', e);
        } finally {
            setRefreshing(false);
        }
    };

    if (loading && !summary) {
        return <div className="loading-state"><span className="spinner" /> Loading analytics...</div>;
    }

    // Prepare chart data
    // Sort history by date just in case
    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));

    // If history is empty, use summary as a single data point if available
    const chartDataPoints = sortedHistory.length > 0 ? sortedHistory : (summary ? [summary] : []);

    // Limit to last 30 entries for readability
    const recentHistory = chartDataPoints.slice(-30);

    const taskChartData = {
        labels: recentHistory.map(h => h.date.slice(5)), // MM-DD
        datasets: [
            {
                label: 'Tasks Completed',
                data: recentHistory.map(h => h.metrics.tasksCompletedToday),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.2,
            }
        ],
    };

    const projectChartData = {
        labels: recentHistory.map(h => h.date.slice(5)),
        datasets: [
            {
                label: 'Active Projects',
                data: recentHistory.map(h => h.metrics.activeProjectsCount),
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
            },
            {
                label: 'Active Tasks',
                data: recentHistory.map(h => h.metrics.activeTasksCount), // Stuck tasks > 7 days
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
            }
        ],
    };

    const m = summary?.metrics;

    return (
        <>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Productivity Analytics</h1>
                <button
                    className="btn btn-secondary"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? 'Syncing...' : '↻ Refresh Data'}
                </button>
            </header>

            <div className="page-body">
                {/* Daily Summary */}
                <div className="section-title">Today's Pulse</div>
                <div className="metrics-grid fade-in">
                    <div className="metric-card">
                        <div className="metric-label">Tasks Completed Today</div>
                        <div className="metric-value accent">{m?.tasksCompletedToday ?? 0}</div>
                        <div className="metric-trend">
                            {m?.tasksCompletedThisWeek ?? 0} this week
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Active &gt; 7 Days</div>
                        <div className="metric-value" style={{ color: (m?.activeTasksCount ?? 0) > 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                            {m?.activeTasksCount ?? 0}
                        </div>
                        <div className="metric-trend">Potential bottlenecks</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Avg Task Time</div>
                        <div className="metric-value">{m?.avgTaskCompletionDays ?? 0}<small>d</small></div>
                        <div className="metric-trend">To completion</div>
                    </div>
                </div>

                {/* Monthly Summary */}
                <div className="section-title" style={{ marginTop: 32 }}>Monthly Overview</div>
                <div className="metrics-grid fade-in stagger-1">
                    <div className="metric-card">
                        <div className="metric-label">Tasks This Month</div>
                        <div className="metric-value">{m?.tasksCompletedThisMonth ?? 0}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Projects This Month</div>
                        <div className="metric-value">{m?.projectsCompletedThisMonth ?? 0}</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Avg Project Time</div>
                        <div className="metric-value">{m?.avgProjectCompletionDays ?? 0}<small>d</small></div>
                    </div>
                </div>

                {/* Charts */}
                <div className="two-col" style={{ marginTop: 32 }}>
                    <div className="card fade-in stagger-2">
                        <div className="card-header">Task Velocity (Daily)</div>
                        <div className="card-body">
                            <Line options={{ responsive: true, plugins: { legend: { display: false } } }} data={taskChartData} />
                        </div>
                    </div>
                    <div className="card fade-in stagger-3">
                        <div className="card-header">Workload/Stuck Items</div>
                        <div className="card-body">
                            <Bar options={{ responsive: true }} data={projectChartData} />
                        </div>
                    </div>
                </div>

                {/* Insights */}
                <div className="section fade-in stagger-4" style={{ marginTop: 32 }}>
                    <div className="section-title">💡 Insights</div>
                    <div className="card">
                        <div className="card-body">
                            <ul style={{ paddingLeft: 20, margin: 0 }}>
                                {(m?.activeTasksCount ?? 0) > 5 && (
                                    <li>⚠️ You have <strong>{m?.activeTasksCount} tasks</strong> active for more than 7 days. Check if they are blocked.</li>
                                )}
                                {(m?.avgTaskActiveDays ?? 0) > 3 && (
                                    <li>ℹ️ Tasks spend an average of <strong>{m?.avgTaskActiveDays} days</strong> in "Active". Try breaking them down smaller.</li>
                                )}
                                {(m?.tasksCompletedThisWeek ?? 0) > (m?.tasksCompletedThisMonth ?? 0) / 4 * 1.5 && (
                                    <li>🔥 You are on fire this week! Above average completion rate.</li>
                                )}
                                {(m?.activeTasksCount ?? 0) === 0 && (m?.tasksCompletedToday ?? 0) > 0 && (
                                    <li>✅ Clean pipeline! No stale tasks.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
