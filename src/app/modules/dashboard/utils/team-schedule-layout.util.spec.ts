import { describe, expect, it } from 'vitest';
import { SCHEDULE_BREAKPOINTS, classifyScheduleSize, scheduleView } from './team-schedule-layout.util';

const cols = (n: number) => n * 97 + (n - 1) * 12;
const rows = (n: number) => n * 96 + (n - 1) * 12;

describe("Today's team schedule layout", () => {
  it.each([
    [cols(2), rows(2), 'mini'],
    [cols(8), rows(2), 'mini'],
    [cols(4), rows(4), 'medium'],
    [cols(8), rows(3), 'medium'],
    [cols(8), rows(4), 'large'],
    [cols(12), rows(8), 'large']
  ] as const)('%ix%i is %s', (w, h, view) => {
    expect(classifyScheduleSize(w, h)).toBe(view);
  });

  it('switches exactly at each breakpoint', () => {
    const b = SCHEDULE_BREAKPOINTS;
    expect(classifyScheduleSize(b.mediumWidth - 1, 400)).toBe('mini');
    expect(classifyScheduleSize(b.mediumWidth, 400)).toBe('medium');
    expect(classifyScheduleSize(400, b.mediumHeight - 1)).toBe('mini');
    expect(classifyScheduleSize(400, b.mediumHeight)).toBe('medium');
    expect(classifyScheduleSize(b.largeWidth - 1, 500)).toBe('medium');
    expect(classifyScheduleSize(b.largeWidth, 500)).toBe('large');
    expect(classifyScheduleSize(800, b.largeHeight - 1)).toBe('medium');
    expect(classifyScheduleSize(800, b.largeHeight)).toBe('large');
    expect(classifyScheduleSize(b.largeWidth + 1, b.largeHeight + 1)).toBe('large');
  });

  it('keeps the previous view inside the 20px hysteresis band, in both directions', () => {
    const b = SCHEDULE_BREAKPOINTS;
    expect(scheduleView(b.largeWidth - 15, 500, 'large')).toBe('large');
    expect(scheduleView(b.largeWidth - 25, 500, 'large')).toBe('medium');
    expect(scheduleView(b.largeWidth + 15, 500, 'medium')).toBe('medium');
    expect(scheduleView(b.largeWidth + 25, 500, 'medium')).toBe('large');
    expect(scheduleView(b.mediumWidth + 15, 400, 'mini')).toBe('mini');
    expect(scheduleView(b.mediumWidth - 15, 400, 'medium')).toBe('medium');
  });

  it('keeps the previous view (or medium) for a zero size', () => {
    expect(scheduleView(0, 0, 'large')).toBe('large');
    expect(scheduleView(0, 0)).toBe('medium');
  });
});
