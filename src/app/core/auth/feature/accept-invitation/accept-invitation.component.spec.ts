import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { AcceptInvitationComponent } from './accept-invitation.component';
import { AuthStore } from '../../state/auth.store';
import { AuthApiService } from '../../data-access/auth-api.service';
import { InvitationPreviewDto } from '../../models/dto/invitation-preview.dto';
import { PublishedLegalDocumentDto } from '../../models/dto/published-legal-document.dto';

@Component({ standalone: true, template: '' })
class RouteTargetStubComponent {}

// ngOnInit awaits Promise.all([firstValueFrom(...), firstValueFrom(...)]) before writing signals -
// under zoneless change detection a single whenStable() can resolve before that chain's extra
// microtask hops finish, so settle across two stability rounds.
async function settle(fixture: { detectChanges: () => void; whenStable: () => Promise<void> }): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await fixture.whenStable();
}

describe('AcceptInvitationComponent', () => {
  const invitation: InvitationPreviewDto = {
    invitation_id: 'inv-1',
    tenant_id: 'tenant-1',
    tenant_name: 'Acme Co',
    invited_email: 'employee@example.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
    role_name: 'Engineer',
    expires_at: '2026-08-20T00:00:00Z',
    status: 'pending',
    password_setup_enabled: true,
    google_sign_in_enabled: false,
    allow_google_email_mismatch: false,
    allowed_email_domains: []
  };

  function setup(options: {
    previewOk?: boolean;
    previewInvitation?: InvitationPreviewDto;
    previewErrorValue?: unknown;
    legalDocumentsOk?: boolean;
    legalDocuments?: PublishedLegalDocumentDto[];
    acceptSpy?: ReturnType<typeof vi.fn>;
  } = {}) {
    const {
      previewOk = true,
      previewInvitation = invitation,
      previewErrorValue = new HttpErrorResponse({ status: 0 }),
      legalDocumentsOk = true,
      legalDocuments = [],
      acceptSpy = vi.fn().mockResolvedValue(undefined)
    } = options;

    const apiStub = {
      getInvitationPreview: vi.fn().mockReturnValue(
        previewOk ? of(previewInvitation) : throwError(() => previewErrorValue)
      ),
      getCurrentLegalDocuments: vi.fn().mockReturnValue(
        legalDocumentsOk ? of(legalDocuments) : throwError(() => new HttpErrorResponse({ status: 500 }))
      )
    };
    const storeStub = {
      acceptEmployeeInvitation: acceptSpy,
      error: () => null,
      loading: () => false
    };

    TestBed.configureTestingModule({
      imports: [AcceptInvitationComponent],
      providers: [
        provideRouter([{ path: 'dashboard', component: RouteTargetStubComponent }]),
        { provide: AuthStore, useValue: storeStub },
        { provide: AuthApiService, useValue: apiStub },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'raw-token' } } } }
      ]
    });

    const fixture = TestBed.createComponent(AcceptInvitationComponent);
    return { fixture, apiStub, storeStub };
  }

  it('loads the invitation preview and legal documents on init', async () => {
    const { fixture } = setup({ legalDocuments: [] });

    await settle(fixture);

    expect(fixture.componentInstance.invitation()).toEqual(invitation);
    expect(fixture.componentInstance.loadingPreview()).toBe(false);
    expect(fixture.componentInstance.previewError()).toBeNull();
  });

  it('shows a not-found message and does not render the form when the preview 404s', async () => {
    const { fixture } = setup({
      previewOk: false,
      previewErrorValue: new HttpErrorResponse({ status: 404 })
    });

    await settle(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.previewError()).toContain('could not be found');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows a network/server failure message (not "invalid or expired") when the preview call fails with a 5xx', async () => {
    const { fixture } = setup({
      previewOk: false,
      previewErrorValue: new HttpErrorResponse({ status: 500 })
    });

    await settle(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.previewError()).toBe('We could not load this invitation. Refresh and try again.');
    expect(fixture.componentInstance.previewError()).not.toContain('invalid or expired');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows the same network/server failure message on a network error (status 0)', async () => {
    const { fixture } = setup({
      previewOk: false,
      previewErrorValue: new HttpErrorResponse({ status: 0 })
    });

    await settle(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.previewError()).toBe('We could not load this invitation. Refresh and try again.');
  });

  it('shows an "already accepted" message and does not render the form when the invitation was already used', async () => {
    const { fixture } = setup({ previewInvitation: { ...invitation, status: 'accepted' } });

    await settle(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.previewError()).toBeNull();
    expect(fixture.componentInstance.statusMessage()).toContain('already been accepted');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows a "revoked" message and does not render the form when the invitation was revoked', async () => {
    const { fixture } = setup({ previewInvitation: { ...invitation, status: 'revoked' } });

    await settle(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.statusMessage()).toContain('revoked');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows an "expired" message and does not render the form when the invitation has expired', async () => {
    const { fixture } = setup({ previewInvitation: { ...invitation, status: 'expired' } });

    await settle(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.statusMessage()).toContain('expired');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('does not fetch legal documents when the invitation is not pending', async () => {
    const { fixture, apiStub } = setup({ previewInvitation: { ...invitation, status: 'expired' } });

    await settle(fixture);

    expect(apiStub.getCurrentLegalDocuments).not.toHaveBeenCalled();
  });

  it('shows the network/server failure message when legal documents fail to load for a pending invitation', async () => {
    const { fixture } = setup({ legalDocumentsOk: false });

    await settle(fixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.previewError()).toBe('We could not load this invitation. Refresh and try again.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('rejects mismatched passwords without calling the store', async () => {
    const { fixture, storeStub } = setup();
    await settle(fixture);

    fixture.componentInstance.form.setValue({
      password: 'Password123!',
      confirmPassword: 'Different123!',
      legalAccepted: false
    });

    await fixture.componentInstance.submit();

    expect(storeStub.acceptEmployeeInvitation).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.confirmPassword.errors).toEqual({ mismatch: true });
  });

  it('requires legal acceptance when documents are pending', async () => {
    const { fixture, storeStub } = setup({
      legalDocuments: [
        { document_type: 'terms', version: 'v1', title: 'Terms', content_html: '', content_text: '', effective_at: null, content_hash: 'h' }
      ]
    });
    await settle(fixture);

    fixture.componentInstance.form.setValue({
      password: 'Password123!',
      confirmPassword: 'Password123!',
      legalAccepted: false
    });

    await fixture.componentInstance.submit();

    expect(storeStub.acceptEmployeeInvitation).not.toHaveBeenCalled();
  });

  it('submits the password and acceptances, then navigates to /dashboard on success', async () => {
    const acceptSpy = vi.fn().mockResolvedValue(undefined);
    const { fixture } = setup({
      legalDocuments: [
        { document_type: 'terms', version: 'v1', title: 'Terms', content_html: '', content_text: '', effective_at: null, content_hash: 'h' }
      ],
      acceptSpy
    });
    await settle(fixture);

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({
      password: 'Password123!',
      confirmPassword: 'Password123!',
      legalAccepted: true
    });

    await fixture.componentInstance.submit();

    expect(acceptSpy).toHaveBeenCalledWith('raw-token', {
      password: 'Password123!',
      confirm_password: 'Password123!',
      acceptances: [{ document_type: 'terms', version: 'v1', decision: 'accepted' }]
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('does not navigate when acceptEmployeeInvitation rejects', async () => {
    const acceptSpy = vi.fn().mockRejectedValue(new Error('expired'));
    const { fixture } = setup({ acceptSpy });
    await settle(fixture);

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({
      password: 'Password123!',
      confirmPassword: 'Password123!',
      legalAccepted: false
    });

    await fixture.componentInstance.submit();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
