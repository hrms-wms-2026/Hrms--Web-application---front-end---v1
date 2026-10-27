import { describe, expect, it } from 'vitest';
import { classifyTeamAttendanceSize, resolveTeamAttendanceView } from './team-attendance-layout.util';

describe('team attendance layout', () => {
  it.each([
    [350, 350, 'small'],
    [300, 640, 'small'],
    [760, 350, 'medium'],
    [560, 260, 'medium'],
    [760, 640, 'large'],
    [1200, 800, 'large'],
    [500, 640, 'medium'],
    [760, 240, 'small']
  ] as const)('%ix%i is %s', (w, h, view) => {
    expect(classifyTeamAttendanceSize(w, h)).toBe(view);
  });

  it('keeps the previous view within the hysteresis band', () => {
    expect(resolveTeamAttendanceView(690, 640, 'large')).toBe('large');
    expect(resolveTeamAttendanceView(650, 640, 'large')).toBe('medium');
  });

  it('keeps the previous view (or small) for a zero size', () => {
    expect(resolveTeamAttendanceView(0, 0, 'large')).toBe('large');
    expect(resolveTeamAttendanceView(0, 300, null)).toBe('small');
  });
});
