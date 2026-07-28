import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LegalConsentComponent } from './legal-consent.component';
import { AuthStore } from '../../state/auth.store';
import { LegalDocumentDto } from '../../models/dto/legal-document.dto';

@Component({ standalone: true, template: '' })
class RouteTargetStubComponent {}

describe('LegalConsentComponent', () => {
  const docs: LegalDocumentDto[] = [
    { document_type: 'privacy_notice', version: '1.0', title: 'ONEVO Privacy Notice', effective_at: '2026-07-28T08:55:29Z', content_url: null },
    { document_type: 'terms', version: '1.0', title: 'ONEVO Terms & Conditions', effective_at: '2026-07-28T08:55:29Z', content_url: null }
  ];

  function setup(authStoreOverrides: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [LegalConsentComponent],
      providers: [
        provideRouter([{ path: 'dashboard', component: RouteTargetStubComponent }]),
        { provide: AuthStore, useValue: authStoreOverrides }
      ]
    });
    const fixture = TestBed.createComponent(LegalConsentComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders each pending legal document title', () => {
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn(),
      authenticated: () => false,
      loading: () => false,
      error: () => null
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('ONEVO Privacy Notice');
    expect(text).toContain('ONEVO Terms & Conditions');
  });

  it('accepts with a decision per pending document and navigates on success', async () => {
    const acceptSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: acceptSpy,
      authenticated: () => true,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await fixture.componentInstance.accept();

    expect(acceptSpy).toHaveBeenCalledWith({
      acceptances: [
        { document_type: 'privacy_notice', version: '1.0', decision: 'accepted' },
        { document_type: 'terms', version: '1.0', decision: 'accepted' }
      ]
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('does not navigate when acceptance fails', async () => {
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn().mockRejectedValue(new Error('network')),
      authenticated: () => false,
      loading: () => false,
      error: () => 'Could not save your acceptance. Please try again.'
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await fixture.componentInstance.accept();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
