import { canAccessNavItem } from './nav-access';
import { NAV_ITEMS } from './nav-items.config';

describe('NAV_ITEMS', () => {
  it('places Monitoring inside the Attendance submenu instead of the primary rail', () => {
    const attendance = NAV_ITEMS.find((item) => item.id === 'time-attendance');

    expect(attendance?.path).toBe('/attendance/time-tracking');
    expect(attendance?.children?.map((item) => item.label)).toEqual(['Time Tracking', 'Monitoring']);
    expect(NAV_ITEMS.some((item) => item.label === 'Monitoring')).toBe(false);
  });

  it('shows Monitoring to an employee with self-service attendance access', () => {
    const attendance = NAV_ITEMS.find((item) => item.id === 'time-attendance')!;
    const monitoring = attendance.children!.find((item) => item.id === 'time-attendance-monitoring')!;
    const checker = {
      hasAnyPermission: (permissions: readonly string[]) => permissions.includes('attendance:read-own'),
      hasAnyModule: (modules: readonly string[]) => modules.includes('time_attendance')
    };

    expect(canAccessNavItem(monitoring, checker)).toBe(true);
  });
});
