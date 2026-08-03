import { toCurrentUserViewModel } from './auth.mapper';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

describe('toCurrentUserViewModel', () => {
  it('maps a fully authenticated response', () => {
    const dto: AuthResponseDto = {
      authenticated: true,
      user: { email: 'siyasiyamala932@gmail.com' },
      permissions: ['integrations:manage'],
      active_modules: ['integrations', 'work_management'],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: false,
      pending_legal_documents: null,
      expires_at: '2026-07-28T09:36:39.2098104+00:00',
      continue_url: null,
      workspace: { slug: 'acme', display_name: 'Acme' }
    };

    expect(toCurrentUserViewModel(dto)).toEqual({
      email: 'siyasiyamala932@gmail.com',
      permissions: ['integrations:manage'],
      activeModules: ['integrations', 'work_management'],
      authenticated: true,
      legalAcceptanceRequired: false,
      pendingLegalDocuments: [],
      workspaceSlug: 'acme',
      redirectRequired: false,
      continueUrl: null
    });
  });

  it('maps a tenant-session-exchange-required response', () => {
    const dto: AuthResponseDto = {
      authenticated: false,
      redirect_required: true,
      user: { email: 'siyasiyamala932@gmail.com' },
      permissions: [],
      active_modules: [],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: false,
      pending_legal_documents: null,
      expires_at: '2026-07-29T11:01:11.5082372+00:00',
      continue_url: 'https://acme.localhost:4200/auth/continue?code=raw',
      workspace: { slug: 'acme', display_name: 'Acme' }
    };

    const view = toCurrentUserViewModel(dto);

    expect(view.authenticated).toBe(false);
    expect(view.redirectRequired).toBe(true);
    expect(view.continueUrl).toBe('https://acme.localhost:4200/auth/continue?code=raw');
  });

  it('maps a pending-legal-acceptance response', () => {
    const dto: AuthResponseDto = {
      authenticated: false,
      user: { email: 'siyasiyamala932@gmail.com' },
      permissions: [],
      active_modules: [],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: true,
      pending_legal_documents: [
        {
          document_type: 'privacy_notice',
          version: '1.0',
          title: 'ONEVO Privacy Notice',
          effective_at: '2026-07-28T08:55:29.331905+00:00',
          content_url: null
        }
      ],
      expires_at: null,
      continue_url: 'https://localhost:7229/api/v1/legal/acceptances/complete-login',
      workspace: { slug: 'acme', display_name: 'Acme' }
    };

    const view = toCurrentUserViewModel(dto);

    expect(view.authenticated).toBe(false);
    expect(view.legalAcceptanceRequired).toBe(true);
    expect(view.pendingLegalDocuments).toHaveLength(1);
    expect(view.pendingLegalDocuments[0].document_type).toBe('privacy_notice');
    expect(view.workspaceSlug).toBe('acme');
  });

  it('defaults pendingLegalDocuments to an empty array when null', () => {
    const dto: AuthResponseDto = {
      authenticated: true,
      user: { email: 'a@b.com' },
      permissions: [],
      active_modules: [],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: false,
      pending_legal_documents: null,
      expires_at: null,
      continue_url: null,
      workspace: { slug: 'acme', display_name: 'Acme' }
    };

    expect(toCurrentUserViewModel(dto).pendingLegalDocuments).toEqual([]);
  });

  it('defaults workspaceSlug to null when workspace is absent', () => {
    const dto: AuthResponseDto = {
      authenticated: false,
      user: { email: 'a@b.com' },
      permissions: [],
      active_modules: [],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: false,
      pending_legal_documents: null,
      expires_at: null,
      continue_url: null,
      workspace: null
    };

    expect(toCurrentUserViewModel(dto).workspaceSlug).toBeNull();
  });
});
