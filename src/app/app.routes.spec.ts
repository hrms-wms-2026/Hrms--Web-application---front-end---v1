import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/state/auth.store';
import { PermissionService } from './core/auth/state/permission.service';

describe('app routes - Settings', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(true) } },
        {
          provide: PermissionService,
          useValue: { hasAnyPermission: () => true, hasAnyModule: () => true, hasPermission: () => true }
        }
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  it('redirects /settings to /settings/general', async () => {
    await router.navigateByUrl('/settings');
    expect(router.url).toBe('/settings/general');
  });

  it('resolves /settings/general to GeneralSettingsComponent', async () => {
    const success = await router.navigateByUrl('/settings/general');
    expect(success).toBe(true);
    expect(router.url).toBe('/settings/general');
  });
});
