import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../data-access/auth-api.service';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

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
    workspace: { slug: 'acme', display_name: 'Acme' }
  };

  const pendingLegalDto: AuthResponseDto = {
    ...authenticatedDto,
    authenticated: false,
    permissions: [],
    active_modules: [],
    legal_acceptance_required: true,
    pending_legal_documents: [
      { document_type: 'privacy_notice', version: '1.0', title: 'Privacy Notice', effective_at: '2026-07-28T08:55:29Z', content_url: null }
    ]
  };

  function setup(apiOverrides: Partial<AuthApiService> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: apiOverrides }]
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
      me: () => of({ ...authenticatedDto, user: { email: 'a@b.com', employeeId: 'emp-123' } })
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

    expect(store.error()).toBe('We could not reach the server. Check your connection and try again.');
    expect(store.loading()).toBe(false);
  });

  it('never shows a technical server detail on login', async () => {
    const serverError = new HttpErrorResponse({ status: 500, error: { detail: 'Npgsql.PostgresException: connection refused' } });
    const store = setup({ login: () => throwError(() => serverError) } as Partial<AuthApiService>);

    await expect(store.login({ email: 'a@b.com', password: 'secret' })).rejects.toBeTruthy();

    expect(store.error()).toBe('Invalid email or password.');
  });

  it('populates state after accepting legal documents', async () => {
    const store = setup({ acceptLegalDocuments: () => of(authenticatedDto) } as Partial<AuthApiService>);

    await store.acceptLegalDocuments({ acceptances: [{ document_type: 'privacy_notice', version: '1.0', decision: 'accepted' }] });

    expect(store.authenticated()).toBe(true);
    expect(store.legalAcceptanceRequired()).toBe(false);
  });

  it('surfaces redirectRequired and continueUrl when the base host hands off to the tenant host', async () => {
    const exchangeRequiredDto: AuthResponseDto = {
      ...authenticatedDto,
      authenticated: false,
      redirect_required: true,
      continue_url: 'https://acme.localhost:4200/auth/continue?code=raw'
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
    const store = setup({ sessionExchange: () => throwError(() => new Error('401')) } as Partial<AuthApiService>);

    await expect(store.exchangeSession('bad-code')).rejects.toBeTruthy();

    expect(store.error()).toBe('This sign-in link is invalid or has expired. Please sign in again.');
    expect(store.loading()).toBe(false);
  });

  it('exchangeSession reports an unreachable-host error on network/TLS/CORS failure (status 0)', async () => {
    const store = setup({
      sessionExchange: () => throwError(() => new HttpErrorResponse({ status: 0 }))
    } as Partial<AuthApiService>);

    await expect(store.exchangeSession('some-code')).rejects.toBeTruthy();

    expect(store.error()).toBe('We could not reach the server. Check your connection and try again.');
    expect(store.loading()).toBe(false);
  });

  it('acceptEmployeeInvitation populates state on success', async () => {
    const store = setup({ acceptEmployeeInvitation: () => of(authenticatedDto) } as unknown as Partial<AuthApiService>);

    await store.acceptEmployeeInvitation('raw-token', {
      password: 'Password123!',
      confirm_password: 'Password123!',
      acceptances: []
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
    const store = setup({ acceptEmployeeInvitation: () => throwError(() => httpError) } as unknown as Partial<AuthApiService>);

    await expect(
      store.acceptEmployeeInvitation('raw-token', { password: 'x', confirm_password: 'x', acceptances: [] })
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
    const store = setup({ me: () => throwError(() => new Error('401')) } as Partial<AuthApiService>);

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
    const store = setup({ login: () => of(authenticatedDto), logout: () => of(undefined) } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    const result = await store.logout();

    expect(result).toBe(true);
    expect(store.authenticated()).toBe(false);
  });

  it('logout returns false and clears session even if the API call rejects', async () => {
    const store = setup({ login: () => of(authenticatedDto), logout: () => throwError(() => new Error('network')) } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    const result = await store.logout();

    expect(result).toBe(false);
    expect(store.authenticated()).toBe(false);
  });
});
