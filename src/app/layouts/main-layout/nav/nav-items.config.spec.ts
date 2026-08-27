import { NAV_ITEMS } from './nav-items.config';

describe('NAV_ITEMS', () => {
  it('places Monitoring inside the Attendance submenu instead of the primary rail', () => {
    const attendance = NAV_ITEMS.find((item) => item.id === 'time-attendance');

    expect(attendance?.path).toBe('/attendance');
    expect(attendance?.children?.map((item) => item.label)).toEqual([
      'Time Tracking',
      'Monitoring',
      'Correction approvals'
    ]);
    expect(NAV_ITEMS.some((item) => item.label === 'Monitoring')).toBe(false);
  });
});
