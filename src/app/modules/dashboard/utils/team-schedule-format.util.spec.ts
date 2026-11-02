import { describe, expect, it } from 'vitest';
import {
  completionText,
  hourTicks,
  itemColor,
  notRankedText,
  percentText,
  spanPosition,
  taskStatusDonut,
  timelineSpan,
} from './team-schedule-format.util';
import { at, scheduleMember, scheduleResponse } from './team-schedule.testing';

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
});
