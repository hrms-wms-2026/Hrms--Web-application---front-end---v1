import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { getState } from '@ngrx/signals';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../data-access/auth-api.service';
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { WorkspaceSelectionRequiredDto } from '../models/dto/workspace-selection.dto';

describe('AuthStore', () => {
  const authenticatedDto: AuthResponseDto = {
    authenticated: true,
    user: { email: 'a@b.com' },
    permissions: ['integrations:manage'],
    active_modules: ['integrations'],
    must_change_password: false,
    mfa_required: false,
    legal_acceptance_required: false,
    pending_legal_documents: null,
    expires_at: '2026-07-28T09:36:39Z',
    continue_url: null,
    workspace: { slug: 'acme', display_name: 'Acme' },
  };

  const pendingLegalDto: AuthResponseDto = {
    ...authenticatedDto,
    authenticated: false,
    permissions: [],
    active_modules: [],
    legal_acceptance_required: true,
    pending_legal_documents: [
      {
        document_type: 'privacy_notice',
        version: '1.0',
        title: 'Privacy Notice',
        effective_at: '2026-07-28T08:55:29Z',
        content_url: null,
      },
    ],
  };

  function setup(apiOverrides: Partial<AuthApiService> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: apiOverrides }],
    });
    return TestBed.inject(AuthStore);
  }

  it('populates state on successful login', async () => {
    const store = setup({ login: () => of(authenticatedDto) } as Partial<AuthApiService>);

    await store.login({ email: 'a@b.com', password: 'secret' });

    expect(store.authenticated()).toBe(true);
    expect(store.email()).toBe('a@b.com');
    expect(store.employeeId()).toBeNull();
    expect(store.permissions()).toEqual(['integrations:manage']);
    expect(store.workspaceSlug()).toBe('acme');
    expect(store.loading()).toBe(false);
  });

  it('threads employeeId from the me response into session state', async () => {
    const store = setup({
      me: () => of({ ...authenticatedDto, user: { email: 'a@b.com', employeeId: 'emp-123' } }),
    } as Partial<AuthApiService>);

    await store.checkSession();

    expect(store.employeeId()).toBe('emp-123');
  });

  it('surfaces legalAcceptanceRequired and pendingLegalDocuments when login is gated', async () => {
    const store = setup({ login: () => of(pendingLegalDto) } as Partial<AuthApiService>);

    await store.login({ email: 'a@b.com', password: 'secret' });

    expect(store.authenticated()).toBe(false);
    expect(store.legalAcceptanceRequired()).toBe(true);
    expect(store.pendingLegalDocuments()).toHaveLength(1);
  });

  it('sets a friendly error message from the ProblemDetails body on failed login', async () => {
    const httpError = { error: { detail: 'Invalid email or password.' } };
    const store = setup({ login: () => throwError(() => httpError) } as Partial<AuthApiService>);

    await expect(store.login({ email: 'a@b.com', password: 'wrong' })).rejects.toBeTruthy();

    expect(store.error()).toBe('Invalid email or password.');
    expect(store.loading()).toBe(false);
  });

  it('says the server is unreachable, not that the password is wrong, when login never reaches the API', async () => {
    const networkError = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
    const store = setup({ login: () => throwError(() => networkError) } as Partial<AuthApiService>);

    await expect(store.login({ email: 'a@b.com', password: 'secret' })).rejects.toBeTruthy();

    expect(store.error()).toBe(
      'We could not reach the server. Check your connection and try again.',
    );
    expect(store.loading()).toBe(false);
  });

  it('never shows a technical server detail on login', async () => {
    const serverError = new HttpErrorResponse({
      status: 500,
      error: { detail: 'Npgsql.PostgresException: connection refused' },
    });
    const store = setup({ login: () => throwError(() => serverError) } as Partial<AuthApiService>);

    await expect(store.login({ email: 'a@b.com', password: 'secret' })).rejects.toBeTruthy();

    expect(store.error()).toBe('Invalid email or password.');
  });

  it('populates state after accepting legal documents', async () => {
    const store = setup({
      acceptLegalDocuments: () => of(authenticatedDto),
    } as Partial<AuthApiService>);

    await store.acceptLegalDocuments({
      acceptances: [{ document_type: 'privacy_notice', version: '1.0', decision: 'accepted' }],
    });

    expect(store.authenticated()).toBe(true);
    expect(store.legalAcceptanceRequired()).toBe(false);
  });

  it('surfaces redirectRequired and continueUrl when the base host hands off to the tenant host', async () => {
    const exchangeRequiredDto: AuthResponseDto = {
      ...authenticatedDto,
      authenticated: false,
      redirect_required: true,
      continue_url: 'https://acme.localhost:4200/auth/continue?code=raw',
    };
    const store = setup({ login: () => of(exchangeRequiredDto) } as Partial<AuthApiService>);

    await store.login({ email: 'a@b.com', password: 'secret' });

    expect(store.authenticated()).toBe(false);
    expect(store.redirectRequired()).toBe(true);
    expect(store.continueUrl()).toBe('https://acme.localhost:4200/auth/continue?code=raw');
  });

  it('exchangeSession populates state on success', async () => {
    const store = setup({ sessionExchange: () => of(authenticatedDto) } as Partial<AuthApiService>);

    await store.exchangeSession('raw-exchange-code');

    expect(store.authenticated()).toBe(true);
    expect(store.email()).toBe('a@b.com');
    expect(store.redirectRequired()).toBe(false);
  });

  it('exchangeSession sets a friendly error and rethrows on failure', async () => {
    const store = setup({
      sessionExchange: () => throwError(() => new Error('401')),
    } as Partial<AuthApiService>);

    await expect(store.exchangeSession('bad-code')).rejects.toBeTruthy();

    expect(store.error()).toBe(
      'This sign-in link is invalid or has expired. Please sign in again.',
    );
    expect(store.loading()).toBe(false);
  });

  it('exchangeSession reports an unreachable-host error on network/TLS/CORS failure (status 0)', async () => {
    const store = setup({
      sessionExchange: () => throwError(() => new HttpErrorResponse({ status: 0 })),
    } as Partial<AuthApiService>);

    await expect(store.exchangeSession('some-code')).rejects.toBeTruthy();

    expect(store.error()).toBe(
      'We could not reach the server. Check your connection and try again.',
    );
    expect(store.loading()).toBe(false);
  });

  it('acceptEmployeeInvitation populates state on success', async () => {
    const store = setup({
      acceptEmployeeInvitation: () => of(authenticatedDto),
    } as unknown as Partial<AuthApiService>);

    await store.acceptEmployeeInvitation('raw-token', {
      password: 'Password123!',
      confirm_password: 'Password123!',
      acceptances: [],
    });

    expect(store.authenticated()).toBe(true);
    expect(store.email()).toBe('a@b.com');
    expect(store.loading()).toBe(false);
  });

  it('acceptEmployeeInvitation posts a non-employee (tenant owner) invitation to accept-password', async () => {
    const acceptEmployee = vi.fn(() => of(authenticatedDto));
    const acceptPassword = vi.fn(() => of(authenticatedDto));
    const store = setup({
      acceptEmployeeInvitation: acceptEmployee,
      acceptInvitationPassword: acceptPassword
    } as unknown as Partial<AuthApiService>);

    await store.acceptEmployeeInvitation(
      'raw-token',
      { password: 'Password123!', confirm_password: 'Password123!', acceptances: [] },
      'general'
    );

    expect(acceptPassword).toHaveBeenCalledWith('raw-token', expect.objectContaining({ password: 'Password123!' }));
    expect(acceptEmployee).not.toHaveBeenCalled();
    expect(store.authenticated()).toBe(true);
  });

  it('acceptEmployeeInvitation keeps employee onboarding invitations on accept-employee', async () => {
    const acceptEmployee = vi.fn(() => of(authenticatedDto));
    const acceptPassword = vi.fn(() => of(authenticatedDto));
    const store = setup({
      acceptEmployeeInvitation: acceptEmployee,
      acceptInvitationPassword: acceptPassword
    } as unknown as Partial<AuthApiService>);

    await store.acceptEmployeeInvitation(
      'raw-token',
      { password: 'x', confirm_password: 'x', acceptances: [] },
      'employee_onboarding'
    );

    expect(acceptEmployee).toHaveBeenCalled();
    expect(acceptPassword).not.toHaveBeenCalled();
  });

  it('acceptEmployeeInvitation sets a friendly error and rethrows on failure', async () => {
    const httpError = { error: { detail: 'This invitation has expired.' } };
    const store = setup({
      acceptEmployeeInvitation: () => throwError(() => httpError),
    } as unknown as Partial<AuthApiService>);

    await expect(
      store.acceptEmployeeInvitation('raw-token', {
        password: 'x',
        confirm_password: 'x',
        acceptances: [],
      }),
    ).rejects.toBeTruthy();

    expect(store.error()).toBe('This invitation has expired.');
    expect(store.loading()).toBe(false);
  });

  it('checkSession returns true and hydrates state when /auth/me succeeds', async () => {
    const store = setup({ me: () => of(authenticatedDto) } as Partial<AuthApiService>);

    const result = await store.checkSession();

    expect(result).toBe(true);
    expect(store.email()).toBe('a@b.com');
  });

  it('checkSession returns false and resets state when /auth/me fails', async () => {
    const store = setup({
      me: () => throwError(() => new Error('401')),
    } as Partial<AuthApiService>);

    const result = await store.checkSession();

    expect(result).toBe(false);
    expect(store.authenticated()).toBe(false);
  });

  it('clearSession resets to initial state', async () => {
    const store = setup({ login: () => of(authenticatedDto) } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    store.clearSession();

    expect(store.authenticated()).toBe(false);
    expect(store.email()).toBeNull();
  });

  it('logout returns true and clears session when API succeeds', async () => {
    const store = setup({
      login: () => of(authenticatedDto),
      logout: () => of(undefined),
    } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    const result = await store.logout();

    expect(result).toBe(true);
    expect(store.authenticated()).toBe(false);
  });

  it('logout returns false and clears session even if the API call rejects', async () => {
    const store = setup({
      login: () => of(authenticatedDto),
      logout: () => throwError(() => new Error('network')),
    } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    const result = await store.logout();

    expect(result).toBe(false);
    expect(store.authenticated()).toBe(false);
  });

  describe('Google sign-in and workspace selection', () => {
    const selectionBody: WorkspaceSelectionRequiredDto = {
      requires_workspace_selection: true,
      login_challenge: 'challenge-1',
      workspaces: [
        { slug: 'acme', displayName: 'Acme' },
        { slug: 'beta', displayName: 'Beta' },
      ],
    };

    it('keeps the Google client id when SSO is enabled', async () => {
      const store = setup({
        getGoogleSsoConfig: () => of({ enabled: true, clientId: 'client-123' }),
      } as Partial<AuthApiService>);
      await store.loadGoogleSsoConfig();
      expect(store.googleClientId()).toBe('client-123');
    });

    it('leaves the Google client id empty when SSO is disabled', async () => {
      const store = setup({
        getGoogleSsoConfig: () => of({ enabled: false, clientId: 'stale' }),
      } as Partial<AuthApiService>);
      await store.loadGoogleSsoConfig();
      expect(store.googleClientId()).toBeNull();
    });

    it('leaves the Google client id empty when enabled but blank', async () => {
      const store = setup({
        getGoogleSsoConfig: () => of({ enabled: true, clientId: '  ' }),
      } as Partial<AuthApiService>);
      await store.loadGoogleSsoConfig();
      expect(store.googleClientId()).toBeNull();
    });

    it('leaves the Google client id empty when the config call fails', async () => {
      const store = setup({
        getGoogleSsoConfig: () => throwError(() => new Error('down')),
      } as Partial<AuthApiService>);
      await expect(store.loadGoogleSsoConfig()).resolves.toBeUndefined();
      expect(store.googleClientId()).toBeNull();
    });

    it('signs in directly with a one-workspace Google ID token', async () => {
      const loginWithGoogle = vi.fn(() => of(authenticatedDto));
      const store = setup({ loginWithGoogle } as Partial<AuthApiService>);

      await expect(store.loginWithGoogle('id-token-abc')).resolves.toBe(true);

      expect(loginWithGoogle).toHaveBeenCalledExactlyOnceWith('id-token-abc');
      expect(store.authenticated()).toBe(true);
      expect(store.workspaceSlug()).toBe('acme');
      expect(store.workspaceSelection()).toBeNull();
    });

    it('surfaces legal acceptance from a Google login', async () => {
      const store = setup({
        loginWithGoogle: () => of(pendingLegalDto),
      } as Partial<AuthApiService>);
      await store.loginWithGoogle('id-token-abc');
      expect(store.legalAcceptanceRequired()).toBe(true);
      expect(store.authenticated()).toBe(false);
    });

    it('surfaces the tenant continue url from a Google login', async () => {
      const store = setup({
        loginWithGoogle: () =>
          of({
            ...authenticatedDto,
            authenticated: false,
            redirect_required: true,
            continue_url: 'https://acme.localhost:4200/auth/continue?code=abc',
          }),
      } as Partial<AuthApiService>);
      await store.loginWithGoogle('id-token-abc');
      expect(store.redirectRequired()).toBe(true);
      expect(store.continueUrl()).toBe('https://acme.localhost:4200/auth/continue?code=abc');
    });

    it('keeps the workspace choices in memory when Google login answers 202', async () => {
      const store = setup({ loginWithGoogle: () => of(selectionBody) } as Partial<AuthApiService>);

      await store.loginWithGoogle('id-token-abc');

      expect(store.authenticated()).toBe(false);
      expect(store.workspaceSelection()).toEqual(selectionBody);
      expect(store.loading()).toBe(false);
    });

    it('keeps the workspace choices when password login answers 202', async () => {
      const store = setup({ login: () => of(selectionBody) } as Partial<AuthApiService>);
      await store.login({ email: 'a@b.com', password: 'secret' });
      expect(store.workspaceSelection()).toEqual(selectionBody);
    });

    it('shows the generic backend message for an unknown Google user', async () => {
      const store = setup({
        loginWithGoogle: () =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 401,
                error: { detail: 'Invalid email or password.' },
              }),
          ),
      } as Partial<AuthApiService>);

      await expect(store.loginWithGoogle('id-token-abc')).rejects.toBeTruthy();

      expect(store.error()).toBe('Invalid email or password.');
      expect(store.authenticated()).toBe(false);
    });

    it('reports an unreachable server when Google login never reaches the API', async () => {
      const store = setup({
        loginWithGoogle: () => throwError(() => new HttpErrorResponse({ status: 0 })),
      } as Partial<AuthApiService>);
      await expect(store.loginWithGoogle('id-token-abc')).rejects.toBeTruthy();
      expect(store.error()).toBe(
        'We could not reach the server. Check your connection and try again.',
      );
    });

    it('sends only one request when the Google credential callback fires twice', async () => {
      const response = new Subject<AuthResponseDto>();
      const loginWithGoogle = vi.fn(() => response.asObservable());
      const store = setup({ loginWithGoogle } as Partial<AuthApiService>);

      const first = store.loginWithGoogle('id-token-abc');
      const second = store.loginWithGoogle('id-token-abc');
      response.next(authenticatedDto);
      response.complete();

      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(false);
      expect(loginWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('never keeps the Google ID token in state', async () => {
      const store = setup({ loginWithGoogle: () => of(selectionBody) } as Partial<AuthApiService>);
      await store.loginWithGoogle('id-token-SECRET');
      expect(JSON.stringify(getState(store))).not.toContain('id-token-SECRET');
    });

    it('finishes sign-in after a workspace is chosen', async () => {
      const selectWorkspace = vi.fn(() => of(authenticatedDto));
      const store = setup({
        loginWithGoogle: () => of(selectionBody),
        selectWorkspace,
      } as Partial<AuthApiService>);

      await store.loginWithGoogle('id-token-abc');
      await store.selectWorkspace('beta');

      expect(selectWorkspace).toHaveBeenCalledWith({
        login_challenge: 'challenge-1',
        workspace: 'beta',
      });
      expect(store.authenticated()).toBe(true);
      expect(store.workspaceSelection()).toBeNull();
    });

    it('refuses a workspace the server did not offer', async () => {
      const selectWorkspace = vi.fn(() => of(authenticatedDto));
      const store = setup({
        loginWithGoogle: () => of(selectionBody),
        selectWorkspace,
      } as Partial<AuthApiService>);

      await store.loginWithGoogle('id-token-abc');
      await expect(store.selectWorkspace('evil')).rejects.toThrow('Unknown workspace.');

      expect(selectWorkspace).not.toHaveBeenCalled();
    });

    it('drops an expired workspace challenge and asks the user to sign in again', async () => {
      const store = setup({
        loginWithGoogle: () => of(selectionBody),
        selectWorkspace: () => throwError(() => new HttpErrorResponse({ status: 401 })),
      } as Partial<AuthApiService>);

      await store.loginWithGoogle('id-token-abc');
      await expect(store.selectWorkspace('beta')).rejects.toBeTruthy();

      expect(store.workspaceSelection()).toBeNull();
      expect(store.error()).toBe('That sign-in has expired. Please sign in again.');
    });

    it('clears the workspace challenge on cancel', async () => {
      const store = setup({ loginWithGoogle: () => of(selectionBody) } as Partial<AuthApiService>);
      await store.loginWithGoogle('id-token-abc');

      store.clearWorkspaceSelection();

      expect(store.workspaceSelection()).toBeNull();
    });
  });
});
