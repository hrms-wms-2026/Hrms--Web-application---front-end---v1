import { Routes } from '@angular/router';
import { routes } from '../../../../app.routes';

function findSettingsChildren(all: Routes): Routes | undefined {
  for (const route of all) {
    if (route.children) {
      const settings = route.children.find((c) => c.path === 'settings');
      if (settings?.children) {
        return settings.children;
      }
      const nested = findSettingsChildren(route.children);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

describe('clock-in-policy routes', () => {
  it('exposes /settings/clock-in-policy settings screen with attendance:read + time_attendance', () => {
    const settingsChildren = findSettingsChildren(routes);
    expect(settingsChildren).toBeTruthy();

    const clockIn = settingsChildren!.find((c) => c.path === 'clock-in-policy');
    expect(clockIn).toBeTruthy();
    expect(clockIn!.children).toBeTruthy();

    const index = clockIn!.children!.find((c) => c.path === '');
    expect(index).toBeTruthy();
    expect(index!.data).toEqual(
      expect.objectContaining({
        title: 'Clock-in Policy',
        permissions: ['attendance:read'],
        modules: ['time_attendance']
      })
    );

    const legacyNew = clockIn!.children!.find((c) => c.path === 'new');
    expect(legacyNew?.redirectTo).toBe('');

    const legacyEdit = clockIn!.children!.find((c) => c.path === ':id/edit');
    expect(legacyEdit?.redirectTo).toBe('');
  });
});
