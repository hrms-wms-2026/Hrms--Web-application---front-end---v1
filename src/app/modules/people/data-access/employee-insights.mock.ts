import {
  AttendanceDayStatus,
  EmployeeOverviewInsightsResponse,
  EmployeeWorkActivityInsightsResponse
} from '../models/employee-insights.model';

/**
 * Development-only sample data in the exact shape the Phase 3 endpoints are designed to return,
 * so the Overview and Work & Activity screens can be built and reviewed before the backend
 * exists. Never served outside the development environment (see EmployeeInsightsApiService).
 */

const DAY_PATTERN: readonly AttendanceDayStatus[] = [
  'present', 'present', 'present', 'present', 'late',
  'present', 'present', 'present', 'present', 'present',
  'present', 'present', 'present', 'missing_clock_out', 'present',
  'present', 'late', 'present', 'leave', 'leave', 'leave', 'present'
];

function monthParts(month: string): { year: number; monthIndex: number; days: number } {
  const [year, m] = month.split('-').map(Number);
  return { year, monthIndex: m - 1, days: new Date(year, m, 0).getDate() };
}

function iso(year: number, monthIndex: number, day: number, hour = 0, minute = 0): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
}

function trendMonths(year: number, monthIndex: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, monthIndex - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function mockOverviewInsights(month: string): EmployeeOverviewInsightsResponse {
  const { year, monthIndex, days } = monthParts(month);
  let workday = 0;
  const attendanceDays = Array.from({ length: days }, (_, i) => {
    const date = new Date(year, monthIndex, i + 1);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const status: AttendanceDayStatus = weekend || workday >= DAY_PATTERN.length ? 'none' : DAY_PATTERN[workday];
    if (!weekend) workday += 1;
    return { date: iso(year, monthIndex, i + 1).slice(0, 10), status };
  });
  const count = (s: AttendanceDayStatus) => attendanceDays.filter((d) => d.status === s).length;

  const months = trendMonths(year, monthIndex, 6);
  return {
    attendance: {
      present: count('present'),
      late: count('late'),
      missingClockOut: count('missing_clock_out'),
      leave: count('leave'),
      days: attendanceDays
    },
    work: { assigned: 24, completed: 18, inProgress: 5, overdue: 1, completionRate: 75, onTimeRate: 89 },
    timeOff: {
      balances: [
        { leaveTypeName: 'Annual leave', remainingDays: 12 },
        { leaveTypeName: 'Sick leave', remainingDays: 8 }
      ],
      upcoming: { startDate: iso(year, monthIndex, 23).slice(0, 10), endDate: iso(year, monthIndex, 25).slice(0, 10), status: 'approved' }
    },
    approvals: [
      { requestType: 'Attendance correction', status: 'pending', note: 'Awaiting reporting manager' },
      { requestType: 'Work area change', status: 'approved', note: null },
      { requestType: 'Leave request', status: 'approved', note: null }
    ],
    recentActivity: [
      { occurredAt: iso(year, monthIndex, 20, 14, 41), action: 'Updated task', subject: 'Implement device sync module' },
      { occurredAt: iso(year, monthIndex, 20, 11, 20), action: 'Attended meeting', subject: 'Project Sync' },
      { occurredAt: iso(year, monthIndex, 20, 10, 5), action: 'Checked in', subject: 'Office' },
      { occurredAt: iso(year, monthIndex, 19, 18, 12), action: 'Submitted request', subject: 'Attendance correction' },
      { occurredAt: iso(year, monthIndex, 16, 16, 32), action: 'Completed task', subject: 'Fix authentication issue' }
    ],
    productivity: {
      index: 88,
      deltaVsPrevious: 2,
      trend: months.map((m, i) => ({ month: m, value: [58, 76, 68, 60, 70, 80][i] })),
      activity: { score: 82, activeMinutes: 150, idleMinutes: 72, meetingMinutes: 65 },
      discipline: { score: 94, lateClockIns: 2, earlyClockOuts: 1, missingClockOuts: 1 },
      delivery: { score: 88, tasksCompleted: 18, tasksTotal: 21, onTimeCompleted: 16, onTimeTotal: 18, storyPointsCompleted: 34, storyPointsTotal: 42 }
    },
    upcomingItems: [
      { date: iso(year, monthIndex, 23).slice(0, 10), title: 'Annual leave', kind: 'leave', status: 'approved' },
      { date: iso(year, monthIndex, 28).slice(0, 10), title: 'Team meeting', kind: 'calendar', status: 'scheduled' },
      { date: iso(year, monthIndex + 1, 3).slice(0, 10), title: '1:1 with manager', kind: 'calendar', status: 'scheduled' }
    ],
    checklists: [
      { name: 'Onboarding', completed: 6, total: 8 },
      { name: 'Security training', completed: 2, total: 2 },
      { name: 'Equipment setup', completed: 1, total: 3 }
    ]
  };
}

export function mockWorkActivityInsights(month: string): EmployeeWorkActivityInsightsResponse {
  const { year, monthIndex } = monthParts(month);
  const hourlyMinutes = [8, 18, 12, 10, 18, 22, 16, 12, 10, 14, 26, 14, 20, 16, 18, 26, 42, 38, 22, 12];
  return {
    summary: { assigned: 24, completed: 18, inProgress: 5, overdue: 1, storyPointsCompleted: 34, storyPointsTotal: 42 },
    needsAttention: [
      { taskId: 't1', taskName: 'Engine specification', projectName: 'Watercraft Platform', issue: '1d 19h overdue', issueSeverity: 'critical', status: 'in_progress', storyPoints: 5 },
      { taskId: 't2', taskName: 'API integration', projectName: 'Core Services', issue: 'Due in 2 days', issueSeverity: 'warning', status: 'in_progress', storyPoints: 8 },
      { taskId: 't3', taskName: 'Device sync module', projectName: 'Monitoring', issue: 'Awaiting review', issueSeverity: 'info', status: 'review', storyPoints: 5 },
      { taskId: 't4', taskName: 'Sprint planning notes', projectName: 'Operations', issue: 'Due in 3 days', issueSeverity: 'info', status: 'to_do', storyPoints: 3 }
    ],
    delivery: {
      completionRate: 75,
      onTimeRate: 89,
      tasksCompleted: 18,
      tasksTotal: 21,
      storyPointsCompleted: 34,
      storyPointsTotal: 42,
      monthly: trendMonths(year, monthIndex, 6).map((m, i) => ({ month: m, completed: [10, 16, 17, 17, 19, 30][i] }))
    },
    recordedActivity: {
      activeMinutes: 150,
      idleMinutes: 12,
      meetingMinutes: 65,
      lastActivityAt: iso(year, monthIndex, 20, 14, 41),
      hourly: hourlyMinutes.map((minutes, i) => {
        const total = 9 * 60 + i * 30;
        return { hour: `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`, activeMinutes: minutes };
      })
    },
    recentTasks: [
      { taskId: 'r1', taskName: 'System documentation', projectName: 'Watercraft Platform', status: 'completed', priority: 'high', dueDate: iso(year, monthIndex, 15).slice(0, 10), storyPoints: 3 },
      { taskId: 'r2', taskName: 'UI refinement', projectName: 'Design System', status: 'in_progress', priority: 'medium', dueDate: iso(year, monthIndex, 16).slice(0, 10), storyPoints: 5 },
      { taskId: 'r3', taskName: 'Test scenarios', projectName: 'Quality Assurance', status: 'in_progress', priority: 'medium', dueDate: iso(year, monthIndex, 18).slice(0, 10), storyPoints: 3 },
      { taskId: 'r4', taskName: 'Performance review', projectName: 'Core Services', status: 'review', priority: 'high', dueDate: iso(year, monthIndex, 20).slice(0, 10), storyPoints: 8 },
      { taskId: 'r5', taskName: 'Deployment plan', projectName: 'Operations', status: 'to_do', priority: 'low', dueDate: iso(year, monthIndex, 22).slice(0, 10), storyPoints: 3 }
    ],
    appUsage: [
      { application: 'VS Code', activeMinutes: 72, sessions: 12, lastUsedAt: iso(year, monthIndex, 20, 14, 35) },
      { application: 'Chrome', activeMinutes: 48, sessions: 18, lastUsedAt: iso(year, monthIndex, 20, 14, 41) },
      { application: 'Microsoft Teams', activeMinutes: 22, sessions: 6, lastUsedAt: iso(year, monthIndex, 20, 13, 20) },
      { application: 'Postman', activeMinutes: 18, sessions: 4, lastUsedAt: iso(year, monthIndex, 20, 11, 5) },
      { application: 'Figma', activeMinutes: 10, sessions: 3, lastUsedAt: iso(year, monthIndex, 20, 10, 12) }
    ],
    workPattern: {
      focusedBlocks: 3,
      topApplication: 'VS Code',
      topApplicationMinutes: 72,
      longestIdleMinutes: 28,
      longestIdleFrom: iso(year, monthIndex, 20, 11, 42),
      longestIdleTo: iso(year, monthIndex, 20, 12, 10)
    }
  };
}
