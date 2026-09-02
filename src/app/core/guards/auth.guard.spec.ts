import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '../auth/state/auth.store';

describe('authGuard', () => {
  function runGuard(url: string) {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url } as never)
    );
  }

  it('allows navigation when checkSession resolves true', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(true) } }]
    });

    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/dashboard' } as never));

    expect(result).toBe(true);
  });

  it('redirects to /auth/login with a returnUrl and denies navigation when checkSession resolves false', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(false) } }]
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const result = await runGuard('/device/activate?request_id=abc&user_code=XYZ');

    expect(result).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/device/activate?request_id=abc&user_code=XYZ' }
    });
  });
});
