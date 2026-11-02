import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_BREAKPOINTS,
  SCHEDULE_CARD_CHROME,
  SCHEDULE_HYSTERESIS,
  SCHEDULE_SECTION_PX,
  ScheduleView,
  classifyScheduleSize,
  planScheduleLayout,
  resolveScheduleView,
  scheduleBodyUsed,
} from './team-schedule-layout.util';

const cols = (n: number) => n * 97 + (n - 1) * 12;
const rows = (n: number) => n * 96 + (n - 1) * 12;

describe('schedule layout ladder', () => {
  const b = SCHEDULE_BREAKPOINTS;

  it('classifies mini, xs, rows and timeline', () => {
    expect(classifyScheduleSize(1200, b.miniHeight - 1)).toBe('mini');
    expect(classifyScheduleSize(b.xsWidth - 1, b.xsMinHeight)).toBe('xs');
    expect(classifyScheduleSize(b.xsWidth - 1, b.xsMinHeight - 1)).toBe('mini');
    expect(classifyScheduleSize(b.xsWidth, 420)).toBe('rows');
    expect(classifyScheduleSize(b.timelineWidth - 1, 420)).toBe('rows');
    expect(classifyScheduleSize(b.timelineWidth, 420)).toBe('timeline');
  });

  it('keeps the previous view within the hysteresis band', () => {
    const h = SCHEDULE_HYSTERESIS;
    expect(resolveScheduleView(b.timelineWidth - h, 420, 'timeline')).toBe('timeline');
    expect(resolveScheduleView(b.timelineWidth - h - 1, 420, 'timeline')).toBe('rows');
    expect(resolveScheduleView(0, 0, null)).toBe('rows');
    expect(resolveScheduleView(0, 0, 'mini')).toBe('mini');
  });

  it('rows never exceed members, nor do day chart rows', () => {
    for (const members of [0, 1, 2, 4, 7]) {
      for (const [w, h] of [[500, 852], [900, 852], [cols(12), rows(8)]]) {
        const view = resolveScheduleView(w, h);
        const plan = planScheduleLayout(view, w, h, members, true);
        expect(plan.rows).toBeLessThanOrEqual(members);
        expect(plan.dayChartRows).toBeLessThanOrEqual(members);
      }
    }
  });

  it('no empty space: what is left is under one row (with its lead gap)', () => {
    for (const plannerEnabled of [true, false]) {
      for (let height = 204; height <= 852; height += 108) {
        for (let width = 300; width <= 1400; width += 100) {
          const view: ScheduleView = resolveScheduleView(width, height);
          if (view === 'mini') continue;
          const plan = planScheduleLayout(view, width, height, 60, plannerEnabled);
          const body = height - SCHEDULE_CARD_CHROME.height;
          const used = scheduleBodyUsed(view, plan, plannerEnabled);
          const rowPx = view === 'timeline' && plannerEnabled ? SCHEDULE_SECTION_PX.line : SCHEDULE_SECTION_PX.row;
          const at = `${width}x${height} planner ${plannerEnabled}`;
          expect(used, at).toBeLessThanOrEqual(body);
          expect(body - used, at).toBeLessThan(rowPx + SCHEDULE_SECTION_PX.gap);
        }
      }
    }
  });

  it('the day chart comes only once five rows fit', () => {
    for (let height = 312; height <= 852; height += 12) {
      const plan = planScheduleLayout('timeline', 900, height, 60, true);
      if (plan.dayChartRows > 0) expect(plan.rows).toBeGreaterThanOrEqual(5);
    }
    expect(planScheduleLayout('timeline', 900, 420, 60, true).dayChartRows).toBe(0);
    expect(planScheduleLayout('timeline', 900, 852, 60, true).dayChartRows).toBeGreaterThan(0);
  });

  it('labels blocks only on the timeline; side column from the side width and enough height', () => {
    expect(planScheduleLayout('timeline', 900, 636, 8, true).blockLabels).toBe(true);
    expect(planScheduleLayout('rows', 500, 636, 8, true).blockLabels).toBe(false);
    expect(planScheduleLayout('timeline', b.sideWidth, 852, 8, true).side).toBe(true);
    expect(planScheduleLayout('timeline', b.sideWidth - 1, 852, 8, true).side).toBe(false);
    expect(planScheduleLayout('timeline', b.sideWidth, rows(3), 8, true).side).toBe(false);
  });

  it('the week chart only at the maximum size', () => {
    expect(planScheduleLayout('timeline', cols(12), rows(8), 8, true).weekChart).toBe(true);
    expect(planScheduleLayout('timeline', 1300, 852, 8, true).weekChart).toBe(true);
    expect(planScheduleLayout('timeline', 1100, 852, 8, true).weekChart).toBe(false);
    expect(planScheduleLayout('timeline', cols(12), rows(6), 8, true).weekChart).toBe(false);
  });

  it('planner off: rows only, no day chart, no week chart, no side column', () => {
    const plan = planScheduleLayout('timeline', cols(12), rows(8), 8, false);
    expect(plan).toMatchObject({ dayChartRows: 0, weekChart: false, side: false, blockLabels: false });
    expect(plan.rows).toBe(8);
  });

  it('mini: pill on the inline form; xs: avatars and pill, then rows', () => {
    expect(planScheduleLayout('mini', 204, 204, 8, true)).toMatchObject({ miniInline: false, pill: false });
    expect(planScheduleLayout('mini', 420, 204, 8, true)).toMatchObject({ miniInline: true, pill: true });
    const xs = planScheduleLayout('xs', 300, 852, 60, true);
    expect(xs).toMatchObject({ avatars: true, pill: true });
    expect(xs.rows).toBeGreaterThan(0);
  });

  it('"View all" is reserved only while rows hide someone', () => {
    expect(planScheduleLayout('timeline', 900, 852, 4, true).viewAll).toBe(false);
    expect(planScheduleLayout('rows', 500, 420, 60, true).viewAll).toBe(true);
  });
});
