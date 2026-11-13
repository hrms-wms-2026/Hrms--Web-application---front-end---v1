import { describe, expect, it } from 'vitest';
import { SEGMENT_COLORS } from '../util/timeline-segments.util';
import { FORECAST_COLORS, FORECAST_STATUS_META, FORECAST_STATUS_TONE, forecastRankChip } from './overtime-forecast-format.util';
import { PLANNED_ACTUAL_COLORS } from './planned-actual-format.util';
import { TEAM_ATTENDANCE_COLORS } from './team-attendance-format.util';
import { TEAM_ATTENDANCE_CARD_COLORS } from './team-attendance-summary-cards.util';
import { teamEmployeeForecastSummaryCards } from './team-employee-forecast-summary-cards.util';
import { employeeForecastResponse } from './team-employee-forecast.testing';
import { teamModuleForecastSummaryCards } from './team-module-forecast-summary-cards.util';
import { moduleForecastResponse } from './team-module-forecast.testing';
import { PRESENCE_COLORS } from './team-presence-format.util';
import { PROGRESS_STATUSES } from './team-progress-format.util';
import { LOAD_COLORS, SCHEDULE_COLORS } from './team-schedule-format.util';
import { TEAM_SCHEDULE_CARD_COLORS } from './team-schedule-summary-cards.util';
import { TEAM_PROGRESS_CARD_COLORS } from './team-progress-summary-cards.util';
import { TEAM_WORK_TASK_COLORS } from './team-work-task-format.util';
import { TEAM_WORK_TASK_CARD_COLORS } from './team-work-task-summary-cards.util';
import { isWidgetColor } from '../../../shared/utils/widget-palette';

/**
 * Guard: every colour map a dashboard widget draws with must hold only monochrome widget colours
 * (`var(--color-widget-*)` from WIDGET, or 'transparent'). A gradient passes when every colour inside it does.
 * A new colour map in utils/ belongs in this file.
 */
const COLOR_KEYS = new Set(['color', 'tone', 'background', 'fill', 'stroke']);

function nonWidgetColors(value: string): string[] {
  if (!/gradient\(/.test(value)) return isWidgetColor(value) ? [] : [value];
  const inner = [...value.matchAll(/var\(--[a-z0-9-]+\)|#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => m[0]);
  return inner.filter((c) => !isWidgetColor(c));
}

/** Every string under a colour-ish key (or every value of a plain colour map) anywhere inside `source`. */
function collect(source: unknown, asMap: boolean, out: string[] = []): string[] {
  if (typeof source === 'string') {
    if (asMap) out.push(source);
    return out;
  }
  if (Array.isArray(source)) {
    for (const item of source) collect(item, asMap, out);
    return out;
  }
  if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string') {
        if (asMap || COLOR_KEYS.has(key)) out.push(value);
      } else {
        collect(value, asMap && typeof value === 'object' && !Array.isArray(value), out);
      }
    }
  }
  return out;
}

/** A plain map of colour strings, e.g. `{ present: WIDGET.shade1, ... }`. */
function expectColorMap(map: object): void {
  const bad = collect(map, true).flatMap(nonWidgetColors);
  expect(bad).toEqual([]);
}

/** Objects with `color` / `tone` / … keys, e.g. status metas, slices or summary cards. */
function expectColorFields(source: unknown): void {
  const values = collect(source, false);
  expect(values.length).toBeGreaterThan(0);
  expect(values.flatMap(nonWidgetColors)).toEqual([]);
}

describe('dashboard widget colour guard', () => {
  it('the helper rejects a hex and accepts a widget gradient', () => {
    expect(nonWidgetColors('#10b981')).toEqual(['#10b981']);
    expect(nonWidgetColors('repeating-linear-gradient(135deg, var(--color-widget-shade-3) 0 4px, var(--color-widget-track) 4px 8px)')).toEqual([]);
    expectColorMap({ done: 'var(--color-widget-shade-1)', nested: { none: 'transparent' } });
    expectColorFields([{ label: 'Done', color: 'var(--color-widget-shade-1)' }]);
  });

  // Task 4: Team Progress + Weekly Work Progress
  it('team progress statuses are widget colours', () => expectColorFields(PROGRESS_STATUSES));
  it('team progress summary cards are widget colours', () => expectColorMap(TEAM_PROGRESS_CARD_COLORS));

  // Task 5: Work vs task hours + Team Status
  it('work vs task hours colours are widget colours', () => expectColorMap(TEAM_WORK_TASK_COLORS));
  it('work vs task hours summary cards are widget colours', () => expectColorMap(TEAM_WORK_TASK_CARD_COLORS));
  it('planned vs actual colours are widget colours', () => expectColorMap(PLANNED_ACTUAL_COLORS));
  it('team presence colours are widget colours', () => expectColorMap(PRESENCE_COLORS));

  // Task 6: Team Schedule
  it('team schedule colours are widget colours', () => {
    expectColorMap(SCHEDULE_COLORS);
    expectColorMap(LOAD_COLORS);
  });
  it('team schedule summary cards are widget colours', () => expectColorMap(TEAM_SCHEDULE_CARD_COLORS));
  it('timeline segment colours (Today at a glance, Activity timeline) are widget colours', () => expectColorMap(SEGMENT_COLORS));

  // Task 7: Overtime forecasts + Team Attendance
  it('overtime forecast colours, statuses and tones are widget colours', () => {
    expectColorMap(FORECAST_COLORS);
    expectColorMap(FORECAST_STATUS_TONE);
    expectColorFields(FORECAST_STATUS_META);
    expectColorFields([forecastRankChip(0.26, 1.2, 'overload'), forecastRankChip(0.26, 0.45, 'raise_rate')]);
  });
  it('module and employee forecast summary cards are widget colours', () => {
    expectColorFields(teamModuleForecastSummaryCards(moduleForecastResponse()));
    expectColorFields(teamEmployeeForecastSummaryCards(employeeForecastResponse()));
  });
  it('team attendance colours are widget colours', () => expectColorMap(TEAM_ATTENDANCE_COLORS));
  it('team attendance summary cards are widget colours', () => expectColorMap(TEAM_ATTENDANCE_CARD_COLORS));
});
