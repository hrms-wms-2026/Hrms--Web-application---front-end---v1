import { TestBed } from '@angular/core/testing';
import { LegalConsentComponent } from './legal-consent.component';
import { AuthStore } from '../../state/auth.store';
import { LegalDocumentDto } from '../../models/dto/legal-document.dto';

describe('LegalConsentComponent', () => {
  const docs: LegalDocumentDto[] = [
    { document_type: 'privacy_notice', version: '1.0', title: 'ONEVO Privacy Notice', effective_at: '2026-07-28T08:55:29Z', content_url: null },
    { document_type: 'terms', version: '1.0', title: 'ONEVO Terms & Conditions', effective_at: '2026-07-28T08:55:29Z', content_url: null }
  ];

  function setup(authStoreOverrides: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [LegalConsentComponent],
      providers: [{ provide: AuthStore, useValue: authStoreOverrides }]
    });
    const fixture = TestBed.createComponent(LegalConsentComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders each pending legal document title', () => {
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn(),
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('ONEVO Privacy Notice');
    expect(text).toContain('ONEVO Terms & Conditions');
  });

  it('accepts with a decision per pending document, then redirects to continue_url when every gate clears', async () => {
    const originalLocation = window.location;
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = { ...originalLocation, href: '' } as unknown as string & Location;

    const acceptSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: acceptSpy,
      redirectRequired: () => true,
      continueUrl: () => 'http://acme.localhost:4200/auth/continue?code=raw-exchange-code',
      loading: () => false,
      error: () => null
    });

    await fixture.componentInstance.accept();

    expect(acceptSpy).toHaveBeenCalledWith({
      acceptances: [
        { document_type: 'privacy_notice', version: '1.0', decision: 'accepted' },
        { document_type: 'terms', version: '1.0', decision: 'accepted' }
      ]
    });
    expect(window.location.href).toBe('http://acme.localhost:4200/auth/continue?code=raw-exchange-code');

    window.location = originalLocation as unknown as string & Location;
  });

  it('does not redirect when acceptance fails', async () => {
    const originalHref = window.location.href;
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn().mockRejectedValue(new Error('network')),
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => 'Could not save your acceptance. Please try again.'
    });

    await fixture.componentInstance.accept();

    expect(window.location.href).toBe(originalHref);
  });
});
