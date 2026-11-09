import { TestBed } from '@angular/core/testing';
import { LegalConsentComponent } from './legal-consent.component';
import { AuthStore } from '../../state/auth.store';
import { LegalDocumentDto } from '../../models/dto/legal-document.dto';

describe('LegalConsentComponent', () => {
  const docs: LegalDocumentDto[] = [
    { document_type: 'privacy_notice', version: '1.0', title: 'CROWNUS Privacy Notice', effective_at: '2026-07-28T08:55:29Z', content_url: null },
    { document_type: 'terms', version: '1.0', title: 'CROWNUS Terms & Conditions', effective_at: '2026-07-28T08:55:29Z', content_url: null }
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

  function stubLocation(hostname: string) {
    const originalLocation = window.location;
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = {
      protocol: originalLocation.protocol,
      hostname,
      port: originalLocation.port,
      href: ''
    } as unknown as string & Location;
    return () => {
      window.location = originalLocation as unknown as string & Location;
    };
  }

  describe('tenant-host redirect', () => {
    it('redirects to root-host /auth/legal-consent when opened on a tenant host with acceptance pending', () => {
      const { protocol, port } = window.location;
      const portSuffix = port ? `:${port}` : '';
      const restore = stubLocation('acme.localhost');

      const fixture = setup({
        pendingLegalDocuments: () => docs,
        acceptLegalDocuments: vi.fn(),
        legalAcceptanceRequired: () => true,
        redirectRequired: () => false,
        continueUrl: () => null,
        loading: () => false,
        error: () => null
      });
      void fixture;

      expect(window.location.href).toBe(`${protocol}//localhost${portSuffix}/auth/legal-consent`);
      restore();
    });

    it('does not redirect on a tenant host when legal acceptance is not required', () => {
      const restore = stubLocation('acme.localhost');

      const fixture = setup({
        pendingLegalDocuments: () => docs,
        acceptLegalDocuments: vi.fn(),
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

    it('does not redirect on the root host even when legal acceptance is required', () => {
      const restore = stubLocation('localhost');

      const fixture = setup({
        pendingLegalDocuments: () => docs,
        acceptLegalDocuments: vi.fn(),
        legalAcceptanceRequired: () => true,
        redirectRequired: () => false,
        continueUrl: () => null,
        loading: () => false,
        error: () => null
      });
      void fixture;

      expect(window.location.href).toBe('');
      restore();
    });
  });

  it('renders each pending legal document title', () => {
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn(),
      legalAcceptanceRequired: () => true,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('CROWNUS Privacy Notice');
    expect(text).toContain('CROWNUS Terms & Conditions');
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
      legalAcceptanceRequired: () => true,
      redirectRequired: () => true,
      continueUrl: () => 'https://acme.localhost:4200/auth/continue?code=raw-exchange-code',
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
    expect(window.location.href).toBe('https://acme.localhost:4200/auth/continue?code=raw-exchange-code');

    window.location = originalLocation as unknown as string & Location;
  });

  it('does not redirect when acceptance fails', async () => {
    const originalHref = window.location.href;
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn().mockRejectedValue(new Error('network')),
      legalAcceptanceRequired: () => true,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => 'Could not save your acceptance. Please try again.'
    });

    await fixture.componentInstance.accept();

    expect(window.location.href).toBe(originalHref);
  });
});
