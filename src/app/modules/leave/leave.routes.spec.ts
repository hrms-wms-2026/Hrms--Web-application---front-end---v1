import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthStore } from '../../core/auth/state/auth.store';
import { LEAVE_ROUTES } from './leave.routes';
import { TIME_OFF_SETTINGS_ROUTES } from './time-off-settings.routes';

const children = LEAVE_ROUTES[0].children ?? [];
const child = (path: string) => children.find((route) => route.path === path);

describe('LEAVE_ROUTES', () => {
  it('opens the hub at /time-off for anyone the parent gate lets in', () => {
    const index = child('');
    expect(index?.data?.['title']).toBe('Time Off');
    expect(index?.canActivate).toBeUndefined();
  });

  it('gates the three hub screens', () => {
    expect(child('availability')?.data?.['permissions']).toEqual(['leave:read-team', 'leave:read']);
    expect(child('requests')?.data?.['permissions']).toEqual(['leave:read-own']);
    expect(child('leave-types')?.data?.['permissions']).toEqual(['leave:read-own']);
  });

  it('sends the old admin URLs to Settings → Time Off and the old pages to their new homes', () => {
    expect(child('types')?.redirectTo).toBe('/settings/time-off/types');
    expect(child('policies')?.redirectTo).toBe('/settings/time-off/policies');
    expect(child('entitlements')?.redirectTo).toBe('/settings/time-off/entitlements');
    expect(child('all')?.redirectTo).toBe('/settings/time-off/requests');
    expect(child('calendar')?.redirectTo).toBe('availability');
    expect(child('team')?.redirectTo).toBe('');
  });

  it('redirects the old team approvals screen into the Inbox (the item itself for ?requestId=)', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const route = child('team-approvals');
    const router = TestBed.inject(Router);
    const redirect = (queryParams: Record<string, string>) => TestBed.runInInjectionContext(() =>
      router.serializeUrl((route!.redirectTo as (r: unknown) => UrlTree)({ queryParams, params: {}, data: {}, url: [], fragment: null })));

    expect(route?.loadComponent).toBeUndefined();
    expect(redirect({})).toBe('/inbox?source=leave&tab=requests');
    expect(redirect({ requestId: 'r1' })).toBe('/inbox/leave/request/r1');
  });
});

describe('TIME_OFF_SETTINGS_ROUTES', () => {
  const settingsChild = (path: string) => TIME_OFF_SETTINGS_ROUTES.find((route) => route.path === path);

  it('keeps each admin screen behind its permission', () => {
    // leave:manage creates leave types, so it opens Leave Types too (the Time Off setup guide links there).
    expect(settingsChild('types')?.data?.['permissions']).toEqual(['leave:read', 'leave:manage']);
    expect(settingsChild('policies')?.data?.['permissions']).toEqual(['leave:manage']);
    expect(settingsChild('entitlements')?.data?.['permissions']).toEqual(['leave:read', 'leave:manage']);
    expect(settingsChild('holidays')?.data?.['permissions']).toEqual(['leave:manage']);
    expect(settingsChild('requests')?.data?.['permissions']).toEqual(['leave:read']);
  });

  it('opens the first tab the viewer may see', () => {
    const redirectFor = (permissions: string[]) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: AuthStore, useValue: { permissions: () => permissions, managesPeople: () => false } }]
      });
      const guard = settingsChild('')!.canActivate![0] as () => UrlTree;
      return TestBed.runInInjectionContext(() => TestBed.inject(Router).serializeUrl(guard()));
    };
    expect(redirectFor(['leave:read'])).toBe('/settings/time-off/types');
    expect(redirectFor(['leave:manage'])).toBe('/settings/time-off/types');
    expect(redirectFor(['leave:approve'])).toBe('/time-off');
  });
});
