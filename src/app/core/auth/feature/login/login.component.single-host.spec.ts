import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { environment } from '@environments/environment';
import { LoginComponent } from './login.component';
import { AuthStore } from '../../state/auth.store';
import { AuthApiService } from '../../data-access/auth-api.service';

describe('LoginComponent on a single host', () => {
  const mutableEnv = environment as unknown as { tenancyMode: string };
  let originalMode: string;
  let originalLocation: Location;

  function stubLocation(search = '') {
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = {
      protocol: 'https:',
      hostname: 'app.azurewebsites.net',
      port: '',
      search,
      href: ''
    } as unknown as string & Location;
  }

  function render() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            login: vi.fn(),
            legalAcceptanceRequired: () => false,
            redirectRequired: () => false,
            continueUrl: () => null,
            loading: () => false,
            error: () => null
          }
        },
        { provide: AuthApiService, useValue: { meForTenant: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } }
      ]
    });
    TestBed.createComponent(LoginComponent).detectChanges();
  }

  beforeEach(() => {
    originalMode = mutableEnv.tenancyMode;
    originalLocation = window.location;
    mutableEnv.tenancyMode = 'single-host';
    sessionStorage.clear();
  });

  afterEach(() => {
    window.location = originalLocation as unknown as string & Location;
    mutableEnv.tenancyMode = originalMode;
    sessionStorage.clear();
  });

  it('on single host with a stored slug, login page redirects once to /auth/login and the slug is cleared', () => {
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    stubLocation();

    render();
    expect(window.location.href).toBe('https://app.azurewebsites.net/auth/login');
    expect(sessionStorage.getItem('crownus.singleHostTenant')).toBeNull();

    // Second evaluation (the reloaded page): no slug, so no further redirect.
    window.location.href = '';
    render();
    expect(window.location.href).toBe('');
  });

  it('does not redirect on single host without a stored slug', () => {
    stubLocation();
    render();
    expect(window.location.href).toBe('');
  });

  it('drops ?tenant= from the redirect target so the reload cannot re-capture the slug', () => {
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    stubLocation('?tenant=acme&returnUrl=%2Fx');
    render();
    expect(window.location.href).toBe('https://app.azurewebsites.net/auth/login?returnUrl=%2Fx');
  });
});
