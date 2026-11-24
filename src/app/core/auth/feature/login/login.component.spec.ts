import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthStore } from '../../state/auth.store';
import { AuthApiService } from '../../data-access/auth-api.service';
import { AuthResponseDto } from '../../models/dto/auth-response.dto';
import { GoogleIdentityService } from '../../data-access/google-identity.service';
import { WorkspaceSelectionRequiredDto } from '../../models/dto/workspace-selection.dto';

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
    workspace: { slug: 'acme', display_name: 'Acme Workspace' },
  };

  const googleIdentity = { renderSignInButton: vi.fn().mockResolvedValue(undefined) };
  let loadGoogleSsoConfig = vi.fn().mockResolvedValue(undefined);

  function setup(
    authStoreOverrides: Record<string, unknown>,
    returnUrl: string | null = null,
    authApiOverrides: Record<string, unknown> = { meForTenant: vi.fn() },
  ) {
    const storeDefaults = {
      loadGoogleSsoConfig,
      googleClientId: () => null,
      workspaceSelection: () => null,
      clearWorkspaceSelection: vi.fn(),
      loading: () => false,
      error: () => null,
    };
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RouteTargetStubComponent },
          { path: 'auth/legal-consent', component: RouteTargetStubComponent },
          { path: 'device/activate', component: RouteTargetStubComponent },
          { path: '**', component: RouteTargetStubComponent },
        ]),
        { provide: AuthStore, useValue: { ...storeDefaults, ...authStoreOverrides } },
        { provide: AuthApiService, useValue: authApiOverrides },
        { provide: GoogleIdentityService, useValue: googleIdentity },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: { get: (key: string) => (key === 'returnUrl' ? returnUrl : null) },
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  function setLastTenantCookie(value: string): void {
    document.cookie = `crownus_last_tenant=${value}; path=/`;
  }

  function clearLastTenantCookie(): void {
    document.cookie = 'crownus_last_tenant=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  }

  async function settleRememberedAccountCheck(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    clearLastTenantCookie();
    loadGoogleSsoConfig = vi.fn().mockResolvedValue(undefined);
    googleIdentity.renderSignInButton = vi.fn().mockResolvedValue(undefined);
  });
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
      href: '',
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
        error: () => null,
      });
      void fixture;

      expect(window.location.href).toBe(`${protocol}//localhost${portSuffix}/auth/login`);
      restore();
    });

    it('preserves returnUrl when bouncing from a tenant host to root-host login', () => {
      const { protocol, port } = window.location;
      const portSuffix = port ? `:${port}` : '';
      const returnUrlQuery = '?returnUrl=%2Fdevice%2Factivate%3Frequest_id%3Dabc%26user_code%3DXYZ';
      const restore = stubLocation('acme.localhost', returnUrlQuery);

      try {
        const fixture = setup({
          login: vi.fn(),
          legalAcceptanceRequired: () => false,
          redirectRequired: () => false,
          continueUrl: () => null,
          loading: () => false,
          error: () => null,
        });
        void fixture;

        expect(window.location.href).toBe(
          `${protocol}//localhost${portSuffix}/auth/login${returnUrlQuery}`,
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
        error: () => null,
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
        error: () => null,
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
      error: () => null,
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
        meForTenant: vi.fn().mockReturnValue(throwError(() => new Error('401'))),
      });

      await settleRememberedAccountCheck();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.login-remembered')).toBeNull();
      expect(fixture.nativeElement.querySelector('.login-form')).not.toBeNull();
    });

    it('rejects a validated response for a different workspace than the cookie hint', async () => {
      setLastTenantCookie('acme');
      const fixture = setup(store, null, {
        meForTenant: vi
          .fn()
          .mockReturnValue(
            of({ ...authenticatedResponse, workspace: { slug: 'other', display_name: 'Other' } }),
          ),
      });

      await settleRememberedAccountCheck();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.login-remembered')).toBeNull();
    });

    it('does not use the email as a fallback when the session has no display name', async () => {
      setLastTenantCookie('acme');
      const fixture = setup(store, null, {
        meForTenant: vi
          .fn()
          .mockReturnValue(
            of({ ...authenticatedResponse, user: { email: 'alex@acme.test', display_name: null } }),
          ),
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
          meForTenant: vi.fn().mockReturnValue(of(authenticatedResponse)),
        });
        await settleRememberedAccountCheck();
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector(
          '.login-remembered__continue',
        ) as HTMLButtonElement;
        button.click();

        const portSuffix = window.location.port ? `:${window.location.port}` : '';
        expect(window.location.href).toBe(
          `${window.location.protocol}//acme.localhost${portSuffix}/dashboard`,
        );
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
      error: () => null,
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
      error: () => null,
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
        error: () => null,
      },
      '/device/activate?request_id=abc&user_code=XYZ',
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
      error: () => null,
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
      error: () => null,
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
      error: () => null,
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(window.location.href).toBe(
      'https://acme.localhost:4200/auth/continue?code=raw-exchange-code',
    );
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
        error: () => null,
      },
      '/device/activate?request_id=abc&user_code=XYZ',
    );

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(window.location.href).toBe(
      'https://acme.localhost:4200/auth/continue?code=raw-exchange-code&returnUrl=%2Fdevice%2Factivate%3Frequest_id%3Dabc%26user_code%3DXYZ',
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
      error: () => 'Invalid email or password.',
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
      error: () => 'Invalid email or password.',
    });

    expect(fixture.nativeElement.textContent).toContain('Invalid email or password.');
  });

  it('drops an unsafe external returnUrl and falls back to the default page', async () => {
    const fixture = setup(
      {
        login: vi.fn().mockResolvedValue(undefined),
        legalAcceptanceRequired: () => false,
        redirectRequired: () => false,
        continueUrl: () => null,
      },
      'https://evil.example/steal',
    );
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    // router.navigate() delegates to navigateByUrl(UrlTree); the unsafe string itself must never be used.
    expect(navigateByUrlSpy).not.toHaveBeenCalledWith('https://evil.example/steal');
    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees']);
  });

  describe('Google sign-in', () => {
    async function settleGoogleSetup(): Promise<void> {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    }

    const baseStore = {
      login: vi.fn(),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
    };

    const googleSection = (el: HTMLElement): HTMLElement =>
      el.querySelector('.login-google') as HTMLElement;

    it('loads the config and draws the official button once when Google is enabled', async () => {
      const fixture = setup({ ...baseStore, googleClientId: () => 'client-123' });

      await settleGoogleSetup();
      fixture.detectChanges();

      expect(loadGoogleSsoConfig).toHaveBeenCalledTimes(1);
      expect(googleIdentity.renderSignInButton).toHaveBeenCalledTimes(1);
      expect(googleIdentity.renderSignInButton).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        'client-123',
        expect.any(Function),
      );
      expect(googleSection(fixture.nativeElement).hidden).toBe(false);
      expect(fixture.nativeElement.querySelector('.login-google-divider')).not.toBeNull();
    });

    it('renders no button and loads no GIS script when Google is disabled or blank', async () => {
      const fixture = setup({ ...baseStore, googleClientId: () => null });

      await settleGoogleSetup();
      fixture.detectChanges();

      expect(googleIdentity.renderSignInButton).not.toHaveBeenCalled();
      expect(googleSection(fixture.nativeElement).hidden).toBe(true);
      expect(fixture.nativeElement.querySelector('.login-google-divider')).toBeNull();
    });

    it('keeps the password form working when the GIS script is blocked', async () => {
      googleIdentity.renderSignInButton = vi.fn().mockRejectedValue(new Error('blocked'));
      const login = vi.fn().mockResolvedValue(undefined);
      const fixture = setup({ ...baseStore, login, googleClientId: () => 'client-123' });

      await settleGoogleSetup();
      fixture.detectChanges();

      expect(googleSection(fixture.nativeElement).hidden).toBe(true);
      expect(fixture.nativeElement.querySelector('.login-form')).not.toBeNull();
      fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
      await fixture.componentInstance.submit();
      expect(login).toHaveBeenCalled();
    });

    it('keeps the password form working when the config call fails', async () => {
      loadGoogleSsoConfig = vi.fn().mockRejectedValue(new Error('down'));
      const fixture = setup({ ...baseStore, googleClientId: () => null });

      await settleGoogleSetup();
      fixture.detectChanges();

      expect(googleSection(fixture.nativeElement).hidden).toBe(true);
      expect(fixture.nativeElement.querySelector('.login-form')).not.toBeNull();
    });

    it('does not fetch Google config on a tenant host (it redirects to root login instead)', () => {
      const restore = stubLocation(
        'acme.localhost',
        '?returnUrl=%2Fdevice%2Factivate%3Frequest_id%3Dabc%26user_code%3DXYZ',
      );
      try {
        setup({ ...baseStore });
        expect(loadGoogleSsoConfig).not.toHaveBeenCalled();
        expect(window.location.href).toContain('/auth/login?returnUrl=%2Fdevice%2Factivate');
      } finally {
        restore();
      }
    });

    it('passes the GIS credential to one Google login and follows continue_url with the tray returnUrl', async () => {
      const restore = stubLocation('localhost');
      const loginWithGoogle = vi.fn().mockResolvedValue(true);
      try {
        const fixture = setup(
          {
            ...baseStore,
            googleClientId: () => 'client-123',
            loginWithGoogle,
            redirectRequired: () => true,
            continueUrl: () => 'https://acme.localhost:4200/auth/continue?code=abc',
          },
          '/device/activate?request_id=abc&user_code=XYZ',
        );
        await settleGoogleSetup();
        const onCredential = googleIdentity.renderSignInButton.mock.calls[0][2] as (
          token: string,
        ) => void;

        onCredential('id-token-abc');
        await settleGoogleSetup();

        expect(loginWithGoogle).toHaveBeenCalledExactlyOnceWith('id-token-abc');
        expect(window.location.href).toBe(
          'https://acme.localhost:4200/auth/continue?code=abc&returnUrl=%2Fdevice%2Factivate%3Frequest_id%3Dabc%26user_code%3DXYZ',
        );
        void fixture;
      } finally {
        restore();
      }
    });

    it('does not navigate for a duplicate credential callback the store ignored', async () => {
      const fixture = setup({ ...baseStore, loginWithGoogle: vi.fn().mockResolvedValue(false) });
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      await fixture.componentInstance.completeGoogleSignIn('id-token-abc');

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('stays on the page and shows the generic error for an unknown Google user', async () => {
      const fixture = setup({
        ...baseStore,
        loginWithGoogle: vi.fn().mockRejectedValue(new Error('401')),
        error: () => 'Invalid email or password.',
      });
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      await fixture.componentInstance.completeGoogleSignIn('id-token-abc');
      fixture.detectChanges();

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Invalid email or password.');
    });

    it('sends a Google user with pending legal documents to legal consent', async () => {
      const fixture = setup({
        ...baseStore,
        loginWithGoogle: vi.fn().mockResolvedValue(true),
        legalAcceptanceRequired: () => true,
      });
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');

      await fixture.componentInstance.completeGoogleSignIn('id-token-abc');

      expect(navigateSpy).toHaveBeenCalledWith(['/auth/legal-consent']);
    });
  });

  describe('workspace selection', () => {
    const selection: WorkspaceSelectionRequiredDto = {
      requires_workspace_selection: true,
      login_challenge: 'challenge-1',
      workspaces: [
        { slug: 'acme', displayName: 'Acme' },
        { slug: 'beta', displayName: 'Beta' },
      ],
    };

    const baseStore = {
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
    };

    it('shows only the server workspaces and hides the login form', () => {
      const fixture = setup({ ...baseStore, workspaceSelection: () => selection });

      const labels = Array.from(
        fixture.nativeElement.querySelectorAll(
          '.workspace-selector__option',
        ) as NodeListOf<HTMLElement>,
      ).map((o) => o.textContent?.trim());
      expect(labels).toEqual(['Acme', 'Beta']);
      expect((fixture.nativeElement.querySelector('.login-main') as HTMLElement).hidden).toBe(true);
    });

    it('does not navigate when password login answers 202', async () => {
      const fixture = setup({ ...baseStore, workspaceSelection: () => selection });
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
      await fixture.componentInstance.submit();

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('never puts the challenge in the URL', () => {
      const fixture = setup({ ...baseStore, workspaceSelection: () => selection });
      expect(TestBed.inject(Router).url).not.toContain('challenge-1');
      expect(fixture.nativeElement.innerHTML).not.toContain('challenge-1');
    });

    it('selects a workspace and continues through the shared routing', async () => {
      const restore = stubLocation('localhost');
      let current: WorkspaceSelectionRequiredDto | null = selection;
      const selectWorkspace = vi.fn().mockImplementation(async () => {
        current = null;
      });
      try {
        const fixture = setup({
          ...baseStore,
          workspaceSelection: () => current,
          selectWorkspace,
          redirectRequired: () => true,
          continueUrl: () => 'https://beta.localhost:4200/auth/continue?code=xyz',
        });

        await fixture.componentInstance.chooseWorkspace('beta');

        expect(selectWorkspace).toHaveBeenCalledWith('beta');
        expect(window.location.href).toBe('https://beta.localhost:4200/auth/continue?code=xyz');
      } finally {
        restore();
      }
    });

    it('stays put when the challenge has expired', async () => {
      const fixture = setup({
        ...baseStore,
        workspaceSelection: () => selection,
        selectWorkspace: vi.fn().mockRejectedValue(new Error('expired')),
      });
      const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate');

      await fixture.componentInstance.chooseWorkspace('beta');

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('cancel clears the in-memory challenge', () => {
      const clearWorkspaceSelection = vi.fn();
      const fixture = setup({
        ...baseStore,
        workspaceSelection: () => selection,
        clearWorkspaceSelection,
      });

      (
        fixture.nativeElement.querySelector('.workspace-selector__cancel') as HTMLButtonElement
      ).click();

      expect(clearWorkspaceSelection).toHaveBeenCalled();
    });
  });
});
