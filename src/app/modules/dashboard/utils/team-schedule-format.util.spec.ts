import { describe, expect, it } from 'vitest';
import {
  WORKLOAD_HIGH,
  WORKLOAD_MEDIUM,
  breakSegments,
  completionText,
  itemDonut,
  timelineLabel,
  toPlannedActualRows,
  toWeekChartDays,
  workloadLevel,
  hourTicks,
  itemColor,
  notRankedText,
  percentText,
  spanPosition,
  taskStatusDonut,
  timelineSpan,
} from './team-schedule-format.util';
import { at, scheduleMember, scheduleResponse, weekResponse } from './team-schedule.testing';

describe("Today's team schedule format", () => {
  it('the donut never includes meetings', () => {
    const summary = {
      ...scheduleResponse([]).summary,
      tasksCompleted: 1,
      tasksInProgress: 1,
      tasksPending: 2,
      meetings: 9,
    };

    const arcs = taskStatusDonut(summary);

    expect(arcs.map((a) => a.key)).toEqual(['completed', 'inProgress', 'pending']);
    expect(arcs.reduce((sum, a) => sum + a.length, 0)).toBeCloseTo(100);
    expect(arcs[2].length).toBeCloseTo(50);
  });

  it('a no-plan worker reads "No plan", never 0%', () => {
    expect(completionText(scheduleMember({ noPlanMinutes: 120, clockedMinutes: 120 }))).toBe(
      'No plan',
    );
    expect(
      completionText(
        scheduleMember({
          plannedTaskMinutes: 60,
          itemCompletionPercent: null,
          items: [
            {
              kind: 'task',
              taskId: 't',
              title: 'A',
              start: at(15),
              end: at(16),
              status: 'pending',
              isPrivate: false,
            },
          ],
        }),
      ),
    ).toBe('—');
    expect(
      completionText(scheduleMember({ plannedTaskMinutes: 60, itemCompletionPercent: 50 })),
    ).toBe('50%');
  });

  it('a missing percentage is "—" and every not-ranked reason has words', () => {
    expect(percentText(null)).toBe('—');
    expect(percentText(0)).toBe('0%');
    expect(notRankedText('planner_off')).toBe('Planner is off');
    expect(notRankedText('on_leave')).toBe('On leave');
    expect(notRankedText('none')).toBe('');
  });

  it('timeline spans the items floored and ceiled to the hour, at least 8 hours, inside 06:00-22:00', () => {
    const member = scheduleMember({
      items: [
        {
          kind: 'task',
          taskId: 't',
          title: 'A',
          start: at(9, 30),
          end: at(11, 15),
          status: 'pending',
          isPrivate: false,
        },
      ],
      unscheduled: [
        { taskId: 't', title: 'A', start: at(12), end: at(12, 40), minutes: 40, kind: 'no_plan' },
      ],
    });
    const span = timelineSpan([member], '2026-10-29');
    expect([span.start.getHours(), span.end.getHours()]).toEqual([9, 17]);

    const late = scheduleMember({
      items: [
        {
          kind: 'meeting',
          taskId: 'm',
          title: 'M',
          start: at(5),
          end: at(23),
          status: 'upcoming',
          isPrivate: false,
        },
      ],
    });
    const clamped = timelineSpan([late], '2026-10-29');
    expect([clamped.start.getHours(), clamped.end.getHours()]).toEqual([6, 22]);

    const evening = scheduleMember({
      items: [
        {
          kind: 'task',
          taskId: 't',
          title: 'A',
          start: at(20),
          end: at(21),
          status: 'pending',
          isPrivate: false,
        },
      ],
    });
    const shifted = timelineSpan([evening], '2026-10-29');
    expect([shifted.start.getHours(), shifted.end.getHours()]).toEqual([14, 22]);

    const empty = timelineSpan([], '2026-10-29');
    expect([empty.start.getHours(), empty.end.getHours()]).toEqual([9, 17]);
  });

  it('positions an interval inside the span and drops one outside it', () => {
    const span = { start: new Date(at(9)), end: new Date(at(17)) };

    expect(spanPosition(at(10), at(12), span)).toEqual({ left: 12.5, width: 25 });
    expect(spanPosition(at(7), at(8), span)).toBeNull();
    expect(spanPosition(at(16), at(19), span)).toEqual({ left: 87.5, width: 12.5 });
    expect(hourTicks(span)).toHaveLength(9);
  });
});

describe("Today's team schedule format (coverage audit)", () => {
  it('a meeting is purple whatever its status; a task colour follows its status', () => {
    const item = (kind: 'task' | 'meeting', status: string) =>
      ({ kind, taskId: 't', title: 'x', start: at(9), end: at(10), status, isPrivate: false }) as never;
    expect(itemColor(item('meeting', 'finished'))).toBe('#8b5cf6');
    expect(itemColor(item('task', 'completed'))).toBe('#10b981');
    expect(itemColor(item('task', 'in_progress'))).toBe('#3b82f6');
    expect(itemColor(item('task', 'scheduled_not_clocked'))).toBe('#cbd5e1');
  });

  it('every not-ranked reason reads as words, never a code', () => {
    for (const reason of ['no_items_yet', 'no_planned_task_time', 'on_leave', 'planner_off'] as const) {
      expect(notRankedText(reason)).toMatch(/^[A-Z][a-z ]+$/);
    }
  });

  it('itemDonut covers completed, in progress, pending and meetings', () => {
    const summary = { ...scheduleResponse([]).summary, tasksCompleted: 5, tasksInProgress: 3, tasksPending: 0, meetings: 4 };
    const arcs = itemDonut(summary);
    // A zero count (pending) draws no arc.
    expect(arcs.map((a) => a.key)).toEqual(['completed', 'inProgress', 'meetings']);
    expect(arcs[2].length).toBeCloseTo(33.33, 1);
  });

  it('timelineLabel names the kind', () => {
    const item = { kind: 'meeting' as const, taskId: 'm', title: 'x', start: at(9), end: at(10), status: 'upcoming' as const, isPrivate: false };
    expect(timelineLabel(item)).toBe('Meeting');
    expect(timelineLabel({ ...item, kind: 'task', status: 'pending' })).toBe('Task');
  });

  it('toPlannedActualRows keeps the backend order and sums task and meeting minutes as planned', () => {
    const rows = toPlannedActualRows([
      scheduleMember({ displayName: 'B', plannedTaskMinutes: 60, plannedMeetingMinutes: 30, scheduledMinutes: 40, outsideSlotMinutes: 5, noPlanMinutes: 10, itemCompletionPercent: 50 }),
      scheduleMember({ displayName: 'A' }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(['B', 'A']);
    expect(rows[0]).toMatchObject({ planned: 90, scheduled: 40, outside: 5, noPlan: 10, completion: 50 });
  });

  it('breakSegments closes an open break at now', () => {
    const now = new Date(at(15));
    const segs = breakSegments(scheduleMember({ breaks: [{ start: at(12), end: at(12, 30) }, { start: at(14, 45), end: null }] }), now);
    expect(segs).toEqual([
      { start: at(12), end: at(12, 30) },
      { start: at(14, 45), end: at(15) },
    ]);
  });

  it('workloadLevel uses planned task + meeting minutes of the work window', () => {
    expect(WORKLOAD_HIGH).toBe(0.9);
    expect(WORKLOAD_MEDIUM).toBe(0.6);
    expect(workloadLevel(scheduleMember({ plannedTaskMinutes: 400, plannedMeetingMinutes: 32, expectedMinutes: 480 }))).toBe('High');
    expect(workloadLevel(scheduleMember({ plannedTaskMinutes: 288, expectedMinutes: 480 }))).toBe('Medium');
    expect(workloadLevel(scheduleMember({ plannedTaskMinutes: 100, expectedMinutes: 480 }))).toBe('Low');
    expect(workloadLevel(scheduleMember({ plannedTaskMinutes: 100, expectedMinutes: null }))).toBeNull();
    expect(workloadLevel(scheduleMember({ plannedTaskMinutes: 100, expectedMinutes: 0 }))).toBeNull();
  });

  it('toWeekChartDays: planned is task + meeting, coverage only for finished days', () => {
    const week = weekResponse({}, [
      { plannedTaskMinutes: 240, plannedMeetingMinutes: 60, scheduledMinutes: 120, clockedMinutes: 150, noPlanMinutes: 30 },
      { plannedTaskMinutes: 240, scheduledMinutes: 60 },
      { plannedTaskMinutes: 120 },
    ]);
    const days = toWeekChartDays(week, '2026-10-27');
    expect(days[0]).toEqual({ date: '2026-10-26', planned: 300, scheduled: 120, outside: 0, noPlan: 30, coveragePercent: 50 });
    expect(days[1].coveragePercent).toBeNull();   // today: the day's plan has not all elapsed
    expect(days[2].coveragePercent).toBeNull();
    expect(days).toHaveLength(7);
  });
});
