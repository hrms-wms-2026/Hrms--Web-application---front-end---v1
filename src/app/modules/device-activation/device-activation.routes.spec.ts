import { Routes } from '@angular/router';
import { routes } from '../../app.routes';
import { authGuard } from '../../core/guards/auth.guard';

describe('device/activate route', () => {
  it('registers device/activate as a top-level route guarded by authGuard', () => {
    const deviceActivate = (routes as Routes).find((route) => route.path === 'device/activate');

    expect(deviceActivate).toBeTruthy();
    expect(deviceActivate?.canActivate).toContain(authGuard);
    expect(deviceActivate?.loadComponent).toBeTypeOf('function');
  });

  it('resolves the lazy-loaded component to DeviceActivationComponent', async () => {
    const deviceActivate = (routes as Routes).find((route) => route.path === 'device/activate');
    const loaded = await deviceActivate!.loadComponent!();

    // The bundler may rename the class (e.g. to "_DeviceActivationComponent"), so assert on
    // its Angular component selector rather than the class name, which isn't stable here.
    expect((loaded as { ɵcmp?: { selectors?: unknown[][] } }).ɵcmp?.selectors).toEqual([['app-device-activation']]);
  });
});
