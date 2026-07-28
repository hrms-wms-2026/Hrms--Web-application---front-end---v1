import { TestBed } from '@angular/core/testing';
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
    continue_url: null
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
    expect(store.permissions()).toEqual(['integrations:manage']);
    expect(store.loading()).toBe(false);
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

  it('populates state after accepting legal documents', async () => {
    const store = setup({ acceptLegalDocuments: () => of(authenticatedDto) } as Partial<AuthApiService>);

    await store.acceptLegalDocuments({ acceptances: [{ document_type: 'privacy_notice', version: '1.0', decision: 'accepted' }] });

    expect(store.authenticated()).toBe(true);
    expect(store.legalAcceptanceRequired()).toBe(false);
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

  it('logout calls the API then clears session even if the API call rejects', async () => {
    const store = setup({ login: () => of(authenticatedDto), logout: () => throwError(() => new Error('network')) } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    await store.logout();

    expect(store.authenticated()).toBe(false);
  });
});
