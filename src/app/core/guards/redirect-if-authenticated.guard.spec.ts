import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { redirectIfAuthenticatedGuard } from './redirect-if-authenticated.guard';
import { AuthStore } from '../auth/state/auth.store';

describe('redirectIfAuthenticatedGuard', () => {
  function runGuard() {
    return TestBed.runInInjectionContext(() => redirectIfAuthenticatedGuard({} as never, {} as never));
  }

  it('allows navigation to the public route when checkSession resolves false', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(false) } }]
    });

    const result = await runGuard();

    expect(result).toBe(true);
  });

  it('redirects an already-authenticated visitor to /dashboard', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(true) } }]
    });
    const router = TestBed.inject(Router);

    const result = await runGuard();

    expect(router.serializeUrl(result as ReturnType<typeof router.createUrlTree>)).toBe('/dashboard');
  });
});
