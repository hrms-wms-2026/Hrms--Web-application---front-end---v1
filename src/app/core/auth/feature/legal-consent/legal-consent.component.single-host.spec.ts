import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { LegalConsentComponent } from './legal-consent.component';
import { AuthStore } from '../../state/auth.store';

describe('LegalConsentComponent on a single host', () => {
  const mutableEnv = environment as unknown as { tenancyMode: string };
  let originalMode: string;
  let originalLocation: Location;

  function render() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LegalConsentComponent],
      providers: [
        {
          provide: AuthStore,
          useValue: {
            pendingLegalDocuments: () => [],
            acceptLegalDocuments: vi.fn(),
            legalAcceptanceRequired: () => true,
            redirectRequired: () => false,
            continueUrl: () => null,
            loading: () => false,
            error: () => null
          }
        }
      ]
    });
    TestBed.createComponent(LegalConsentComponent).detectChanges();
  }

  beforeEach(() => {
    originalMode = mutableEnv.tenancyMode;
    originalLocation = window.location;
    mutableEnv.tenancyMode = 'single-host';
    sessionStorage.clear();
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = {
      protocol: 'https:',
      hostname: 'app.azurewebsites.net',
      port: '',
      search: '',
      href: ''
    } as unknown as string & Location;
  });

  afterEach(() => {
    window.location = originalLocation as unknown as string & Location;
    mutableEnv.tenancyMode = originalMode;
    sessionStorage.clear();
  });

  it('with a stored slug redirects once to /auth/legal-consent and clears the slug; a second evaluation does not redirect', () => {
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');

    render();
    expect(window.location.href).toBe('https://app.azurewebsites.net/auth/legal-consent');
    expect(sessionStorage.getItem('crownus.singleHostTenant')).toBeNull();

    window.location.href = '';
    render();
    expect(window.location.href).toBe('');
  });
});
