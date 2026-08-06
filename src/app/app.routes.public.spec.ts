import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/state/auth.store';

describe('app routes - public landing', () => {
  async function setUp(checkSession: () => Promise<boolean>): Promise<Router> {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { checkSession } }
      ]
    }).compileComponents();
    return TestBed.inject(Router);
  }

  it('shows the landing page at "/" for a guest', async () => {
    const router = await setUp(() => Promise.resolve(false));

    const success = await router.navigateByUrl('/');

    expect(success).toBe(true);
    expect(router.url).toBe('/');
  });

  it('redirects an already-authenticated visitor from "/" to /dashboard', async () => {
    const router = await setUp(() => Promise.resolve(true));

    await router.navigateByUrl('/');

    expect(router.url).toBe('/dashboard');
  });

  it('resolves /book-a-demo without requiring authentication', async () => {
    const router = await setUp(() => Promise.resolve(false));

    const success = await router.navigateByUrl('/book-a-demo');

    expect(success).toBe(true);
    expect(router.url).toBe('/book-a-demo');
  });

  it('resolves the legal routes without requiring authentication', async () => {
    const router = await setUp(() => Promise.resolve(false));

    expect(await router.navigateByUrl('/legal/terms')).toBe(true);
    expect(await router.navigateByUrl('/legal/privacy')).toBe(true);
  });
});
