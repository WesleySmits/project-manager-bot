export type AgenticPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type AgenticDashboardArea =
    | 'Tasks'
    | 'Mail'
    | 'Decisions'
    | 'Finance'
    | 'Leads'
    | 'Readiness'
    | 'System';

export type AgenticDashboardMode = 'notion' | 'disabled' | 'error';

export interface AgenticDashboardItem {
    id: string;
    title: string;
    area: AgenticDashboardArea;
    priority: AgenticPriority;
    source: string;
    sourceKey?: string;
    summary: string;
    nextStep: string;
    url?: string;
    forDate?: string;
    lastSeenAt?: string;
    sortScore: number;
    sensitive: boolean;
    externalAction: boolean;
}

export interface AgenticDecisionItem {
    id: string;
    title: string;
    status: string;
    area: string;
    priority: AgenticPriority;
    risk: string;
    decisionNeeded: string;
    url?: string;
    dueDate?: string;
}

export interface AgenticReportHealth {
    label: string;
    reportType: string;
    lastRun?: string;
    status: 'Fresh' | 'Stale' | 'Missing' | 'Needs Review';
    url?: string;
    reason: string;
    actionLabel: string;
    ageDays?: number;
}

export interface AgenticStartHereItem {
    id: string;
    title: string;
    area: AgenticDashboardArea;
    priority: AgenticPriority;
    source: string;
    why: string;
    nextStep: string;
    url?: string;
    sourceKey?: string;
    sortScore: number;
}

export interface AgenticDashboardData {
    enabled: boolean;
    generatedAt: string;
    today: string;
    mode: AgenticDashboardMode;
    warnings: string[];
    startHere: AgenticStartHereItem[];
    focusItems: AgenticDashboardItem[];
    mailItems: AgenticDashboardItem[];
    signals: AgenticDashboardItem[];
    decisions: AgenticDecisionItem[];
    sourceHealth: AgenticReportHealth[];
}
