import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../data-access/auth-api.service';

describe('AuthStore single-host logout', () => {
  const mutableEnv = environment as unknown as { tenancyMode: string };
  let originalMode: string;

  beforeEach(() => {
    originalMode = mutableEnv.tenancyMode;
    mutableEnv.tenancyMode = 'single-host';
    sessionStorage.clear();
  });

  afterEach(() => {
    mutableEnv.tenancyMode = originalMode;
    sessionStorage.clear();
  });

  it('logout clears single-host slug', async () => {
    sessionStorage.setItem('crownus.singleHostTenant', 'acme');
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: { logout: () => of(undefined) } }]
    });
    await TestBed.inject(AuthStore).logout();
    expect(sessionStorage.getItem('crownus.singleHostTenant')).toBeNull();
  });
});
