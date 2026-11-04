import { PlannerPersonDay } from '../../work/planner/models/team-planner.models';
import { LOAD_BAND_COLORS, dayLoad, formatHours, loadBand } from './team-load';

describe('team load rules (team planner, 2026-11-03)', () => {
  it.each([
    [0, 480, true, 'leave'], [0, 480, false, 'none'], [180, 480, false, 'under'], [360, 480, false, 'mid'],
    [480, 480, false, 'full'], [510, 480, false, 'over'], [60, 0, false, 'over'], [0, 0, false, 'none'],
  ] as const)('loadBand(%i, %i, %s) = %s', (load, cap, leave, band) => expect(loadBand(load, cap, leave)).toBe(band));

  it.each([[0, '—'], [360, '6h'], [450, '7.5h'], [400, '6h 40m'], [30, '30m']] as const)(
    'formatHours(%i) = %s', (minutes, label) => expect(formatHours(minutes)).toBe(label));

  it('dayLoad adds block and meeting minutes', () => {
    expect(dayLoad({ blockMinutes: 300, meetingMinutes: 60 } as PlannerPersonDay)).toBe(360);
  });

  it('has the approved heatmap colours', () => {
    expect(LOAD_BAND_COLORS.full).toEqual({ bg: '#1d4ed8', fg: '#ffffff' });
    expect(LOAD_BAND_COLORS.over).toEqual({ bg: '#c2410c', fg: '#ffffff' });
    expect(LOAD_BAND_COLORS.leave).toEqual({ bg: '#fde68a', fg: '#78350f' });
  });
});
