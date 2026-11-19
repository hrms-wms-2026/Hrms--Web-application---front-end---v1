import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthStore } from '../../state/auth.store';
import { AuthApiService } from '../../data-access/auth-api.service';
import { AuthResponseDto } from '../../models/dto/auth-response.dto';

@Component({ standalone: true, template: '' })
class RouteTargetStubComponent {}

describe('LoginComponent', () => {
  const authenticatedResponse: AuthResponseDto = {
    authenticated: true,
    user: { email: 'alex@acme.test', display_name: 'Alex Morgan' },
    permissions: [],
    active_modules: [],
    must_change_password: false,
    mfa_required: false,
    legal_acceptance_required: false,
    pending_legal_documents: null,
    expires_at: null,
    continue_url: null,
    workspace: { slug: 'acme', display_name: 'Acme Workspace' }
  };

  function setup(
    authStoreOverrides: Record<string, unknown>,
    returnUrl: string | null = null,
    authApiOverrides: Record<string, unknown> = { meForTenant: vi.fn() }
  ) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RouteTargetStubComponent },
          { path: 'auth/legal-consent', component: RouteTargetStubComponent },
          { path: 'device/activate', component: RouteTargetStubComponent },
          { path: '**', component: RouteTargetStubComponent }
        ]),
        { provide: AuthStore, useValue: authStoreOverrides },
        { provide: AuthApiService, useValue: authApiOverrides },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (key: string) => (key === 'returnUrl' ? returnUrl : null) } }
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  function setLastTenantCookie(value: string): void {
    document.cookie = `onevo_last_tenant=${value}; path=/`;
  }

  function clearLastTenantCookie(): void {
    document.cookie = 'onevo_last_tenant=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  }

  async function settleRememberedAccountCheck(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(clearLastTenantCookie);
  afterEach(clearLastTenantCookie);

  function stubLocation(hostname: string, search = '') {
    const originalLocation = window.location;
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = {
      protocol: originalLocation.protocol,
      hostname,
      port: originalLocation.port,
      search,
      href: ''
    } as unknown as string & Location;
    return () => {
      window.location = originalLocation as unknown as string & Location;
    };
  }

  describe('tenant-host redirect', () => {
    it('redirects the browser to root-host /auth/login when opened on a tenant subdomain', () => {
      const { protocol, port } = window.location;
      const portSuffix = port ? `:${port}` : '';
      const restore = stubLocation('acme.localhost');

      const fixture = setup({
        login: vi.fn(),
        legalAcceptanceRequired: () => false,
        redirectRequired: () => false,
        continueUrl: () => null,
        loading: () => false,
        error: () => null
      });
      void fixture;

      expect(window.location.href).toBe(`${protocol}//localhost${portSuffix}/auth/login`);
      restore();
    });

    it('preserves returnUrl when bouncing from a tenant host to root-host login', () => {
      const { protocol, port } = window.location;
      const portSuffix = port ? `:${port}` : '';
      const returnUrlQuery =
        '?returnUrl=%2Fdevice%2Factivate%3Frequest_id%3Dabc%26user_code%3DXYZ';
      const restore = stubLocation('acme.localhost', returnUrlQuery);

      try {
        const fixture = setup({
          login: vi.fn(),
          legalAcceptanceRequired: () => false,
          redirectRequired: () => false,
          continueUrl: () => null,
          loading: () => false,
          error: () => null
        });
        void fixture;

        expect(window.location.href).toBe(
          `${protocol}//localhost${portSuffix}/auth/login${returnUrlQuery}`
        );
      } finally {
        restore();
      }
    });

    it('does not redirect when already on the root host', () => {
      const restore = stubLocation('localhost');

      const fixture = setup({
        login: vi.fn(),
        legalAcceptanceRequired: () => false,
        redirectRequired: () => false,
        continueUrl: () => null,
        loading: () => false,
        error: () => null
      });
      void fixture;

      expect(window.location.href).toBe('');
      restore();
    });

    it('does not submit login when called from a tenant host', async () => {
      const restore = stubLocation('acme.localhost');
      const loginSpy = vi.fn();

      const fixture = setup({
        login: loginSpy,
        legalAcceptanceRequired: () => false,
        redirectRequired: () => false,
        continueUrl: () => null,
        loading: () => false,
        error: () => null
      });

      fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
      await fixture.componentInstance.submit();

      expect(loginSpy).not.toHaveBeenCalled();
      restore();
    });
  });

  describe('remembered account', () => {
    const store = {
      login: vi.fn(),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    };

    it('validates the tenant hint and renders the confirmed account', async () => {
      setLastTenantCookie('acme');
      const meForTenant = vi.fn().mockReturnValue(of(authenticatedResponse));
      const fixture = setup(store, null, { meForTenant });

      await settleRememberedAccountCheck();
      fixture.detectChanges();

      expect(meForTenant).toHaveBeenCalledWith('acme');
      const cardText = fixture.nativeElement.querySelector('.login-remembered').textContent;
      expect(cardText).toContain('You’re already signed in');
      expect(cardText).toContain('Alex Morgan');
      expect(cardText).not.toContain('Acme Workspace');
      expect(cardText).not.toContain('alex@acme.test');
      expect(cardText).toContain('Continue to workspace');
    });

    it('does not present the cookie hint as an account when session validation fails', async () => {
      setLastTenantCookie('acme');
      const fixture = setup(store, null, {
        meForTenant: vi.fn().mockReturnValue(throwError(() => new Error('401')))
      });

      await settleRememberedAccountCheck();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.login-remembered')).toBeNull();
      expect(fixture.nativeElement.querySelector('.login-form')).not.toBeNull();
    });

    it('rejects a validated response for a different workspace than the cookie hint', async () => {
      setLastTenantCookie('acme');
      const fixture = setup(store, null, {
        meForTenant: vi.fn().mockReturnValue(
          of({ ...authenticatedResponse, workspace: { slug: 'other', display_name: 'Other' } })
        )
      });

      await settleRememberedAccountCheck();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.login-remembered')).toBeNull();
    });

    it('does not use the email as a fallback when the session has no display name', async () => {
      setLastTenantCookie('acme');
      const fixture = setup(store, null, {
        meForTenant: vi.fn().mockReturnValue(
          of({ ...authenticatedResponse, user: { email: 'alex@acme.test', display_name: null } })
        )
      });

      await settleRememberedAccountCheck();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.login-remembered')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('alex@acme.test');
    });

    it('does not make a session request when no valid tenant hint exists', () => {
      setLastTenantCookie('acme.evil.test');
      const meForTenant = vi.fn();

      setup(store, null, { meForTenant });

      expect(meForTenant).not.toHaveBeenCalled();
    });

    it('continues to the validated tenant dashboard without requesting credentials', async () => {
      setLastTenantCookie('acme');
      const restore = stubLocation('localhost');

      try {
        const fixture = setup(store, null, {
          meForTenant: vi.fn().mockReturnValue(of(authenticatedResponse))
        });
        await settleRememberedAccountCheck();
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector('.login-remembered__continue') as HTMLButtonElement;
        button.click();

        const portSuffix = window.location.port ? `:${window.location.port}` : '';
        expect(window.location.href).toBe(`${window.location.protocol}//acme.localhost${portSuffix}/dashboard`);
      } finally {
        restore();
      }
    });
  });

  it('does not call login when the form is invalid', async () => {
    const loginSpy = vi.fn();
    const fixture = setup({
      login: loginSpy,
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });

    await fixture.componentInstance.submit();

    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('calls login with the form values when valid', async () => {
    const loginSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = setup({
      login: loginSpy,
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(loginSpy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
  });

  it('navigates to returnUrl after a successful login when present, preserving its query params', async () => {
    const fixture = setup(
      {
        login: vi.fn().mockResolvedValue(undefined),
        legalAcceptanceRequired: () => false,
        redirectRequired: () => false,
        continueUrl: () => null,
        loading: () => false,
        error: () => null
      },
      '/device/activate?request_id=abc&user_code=XYZ'
    );
    const router = TestBed.inject(Router);

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    // Assert the router actually ended up at the right place, not just that some navigate
    // overload was called with the right-looking argument — router.navigate(['/a?b=c']) treats
    // the whole string as one path segment and drops the query params silently, which a
    // navigate-was-called-with assertion alone would not have caught.
    expect(router.url).toBe('/device/activate?request_id=abc&user_code=XYZ');
  });

  it('falls back to /people/employees when no returnUrl is present', async () => {
    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees']);
  });

  it('navigates to /auth/legal-consent when login succeeds but legal acceptance is required', async () => {
    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => true,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/legal-consent']);
  });

  it('redirects the browser to continue_url when every gate clears (base-domain login hands off to the tenant host)', async () => {
    const originalLocation = window.location;
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = { ...originalLocation, href: '' } as unknown as string & Location;

    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => true,
      continueUrl: () => 'https://acme.localhost:4200/auth/continue?code=raw-exchange-code',
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(window.location.href).toBe('https://acme.localhost:4200/auth/continue?code=raw-exchange-code');
    expect(navigateSpy).not.toHaveBeenCalled();

    window.location = originalLocation as unknown as string & Location;
  });

  it('appends returnUrl to continue_url when present (cross-host handoff must not drop it)', async () => {
    const originalLocation = window.location;
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = { ...originalLocation, href: '' } as unknown as string & Location;

    const fixture = setup(
      {
        login: vi.fn().mockResolvedValue(undefined),
        legalAcceptanceRequired: () => false,
        redirectRequired: () => true,
        continueUrl: () => 'https://acme.localhost:4200/auth/continue?code=raw-exchange-code',
        loading: () => false,
        error: () => null
      },
      '/device/activate?request_id=abc&user_code=XYZ'
    );

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(window.location.href).toBe(
      'https://acme.localhost:4200/auth/continue?code=raw-exchange-code&returnUrl=%2Fdevice%2Factivate%3Frequest_id%3Dabc%26user_code%3DXYZ'
    );

    window.location = originalLocation as unknown as string & Location;
  });

  it('does not navigate when login rejects', async () => {
    const fixture = setup({
      login: vi.fn().mockRejectedValue(new Error('bad credentials')),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => 'Invalid email or password.'
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'wrong' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('renders the store error message', () => {
    const fixture = setup({
      login: vi.fn(),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => 'Invalid email or password.'
    });

    expect(fixture.nativeElement.textContent).toContain('Invalid email or password.');
  });
});
