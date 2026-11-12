import { describe, expect, it } from 'vitest';
import { isWidgetColor } from './widget-palette';

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
  it.todo('team progress statuses are widget colours');
  it.todo('team progress summary cards are widget colours');

  // Task 5: Work vs task hours + Team Status
  it.todo('work vs task hours colours are widget colours');
  it.todo('work vs task hours summary cards are widget colours');
  it.todo('planned vs actual colours are widget colours');
  it.todo('team presence colours are widget colours');

  // Task 6: Team Schedule
  it.todo('team schedule colours are widget colours');
  it.todo('team schedule summary cards are widget colours');

  // Task 7: Overtime forecasts + Team Attendance
  it.todo('overtime forecast colours, statuses and tones are widget colours');
  it.todo('module and employee forecast summary cards are widget colours');
  it.todo('team attendance colours are widget colours');
  it.todo('team attendance summary cards are widget colours');
});
