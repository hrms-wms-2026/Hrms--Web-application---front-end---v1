import { describe, expect, it } from 'vitest';
import { TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { TeamTodayResponse } from '../models/my-team-today.model';
import { buildTeamKpis } from './team-kpi.util';

const NOW = new Date('2026-10-07T12:00:00Z');
const ALL = ['teamStatus', 'actionCenter', 'teamProgress'] as const;

function today(summary: Partial<TeamTodayResponse['summary']> = {}): TeamTodayResponse {
  return {
    workDate: '2026-10-07', timezone: 'UTC', legalEntityId: 'le-1', members: [], totalMembers: 10,
    summary: {
      total: 10, working: 6, onBreak: 1, clockedOut: 1, late: 2, absent: 1, notStarted: 0,
      onLeave: 1, notScheduled: 0, needsAttention: 3, ...summary
    }
  };
}

function actionItems(sources: Partial<TeamActionItemsResponse['sources'][number]>[]): TeamActionItemsResponse {
  return {
    legalEntityId: 'le-1',
    sources: sources.map((s) => ({
      sourceKey: 'leave.approval', domain: 'people' as const, status: 'ok' as const, pendingCount: 0,
      inProgressCount: null, oldestPendingAt: null, topItems: [], ...s
    }))
  };
}

const PROGRESS: LedWorkProgressResponse = {
  totals: { total: 138, completed: 24, inProgress: 45, notStarted: 67, overdue: 2 },
  projects: [], overdueTasks: [], overdueTotal: 2
};

describe('buildTeamKpis', () => {
  it('counts present as working + on break + clocked out, against people expected in', () => {
    const tiles = buildTeamKpis({ visibleWidgets: ALL, today: today(), actionItems: null, ledProgress: null, now: NOW });
    const present = tiles.find((t) => t.key === 'present')!;
    // late (2) is an overlay flag and must not be added on top of the status buckets.
    expect(present.value).toBe('8 / 9');
    expect(present.caption).toBe('89% in');
    expect(present.tone).toBe('warning');
  });

  it('uses the backend needsAttention count and surfaces late in the caption', () => {
    const tiles = buildTeamKpis({ visibleWidgets: ALL, today: today(), actionItems: null, ledProgress: null, now: NOW });
    const attention = tiles.find((t) => t.key === 'attention')!;
    expect(attention.value).toBe('3');
    expect(attention.caption).toBe('2 late');
  });

  it('sums pending approvals over ok sources, excludes exceptions, and reports the oldest age', () => {
    const tiles = buildTeamKpis({
      visibleWidgets: ALL, today: null, ledProgress: null, now: NOW,
      actionItems: actionItems([
        { pendingCount: 15, oldestPendingAt: '2026-10-01T12:00:00Z' },
        { sourceKey: 'work.objective_change', domain: 'work', pendingCount: 5, oldestPendingAt: '2026-10-05T12:00:00Z' },
        { sourceKey: 'monitoring.exception', pendingCount: 9 }
      ])
    });
    const approvals = tiles.find((t) => t.key === 'approvals')!;
    expect(approvals.value).toBe('20');
    expect(approvals.caption).toBe('Oldest 6d');
    expect(approvals.tone).toBe('critical');
  });

  it('marks the approvals count as a lower bound when a source is unavailable', () => {
    const tiles = buildTeamKpis({
      visibleWidgets: ALL, today: null, ledProgress: null, now: NOW,
      actionItems: actionItems([{ pendingCount: 4 }, { sourceKey: 'attendance.correction', status: 'unavailable' }])
    });
    expect(tiles.find((t) => t.key === 'approvals')!.value).toBe('4+');
  });

  it('shows overdue work against total tasks', () => {
    const tiles = buildTeamKpis({ visibleWidgets: ALL, today: null, actionItems: null, ledProgress: PROGRESS, now: NOW });
    const overdue = tiles.find((t) => t.key === 'overdue')!;
    expect(overdue.value).toBe('2');
    expect(overdue.caption).toBe('24 of 138 done');
    expect(overdue.tone).toBe('critical');
  });

  it('omits tiles whose widget is hidden or whose store has not loaded, instead of showing zero', () => {
    expect(
      buildTeamKpis({ visibleWidgets: ['actionCenter'], today: today(), actionItems: null, ledProgress: PROGRESS, now: NOW })
    ).toEqual([]);
  });

  it('orders tiles present, approvals, attention, overdue', () => {
    const tiles = buildTeamKpis({ visibleWidgets: ALL, today: today(), actionItems: actionItems([]), ledProgress: PROGRESS, now: NOW });
    expect(tiles.map((t) => t.key)).toEqual(['present', 'approvals', 'attention', 'overdue']);
  });
});
