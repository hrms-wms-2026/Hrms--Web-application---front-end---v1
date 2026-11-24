import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../core/interceptors/error.interceptor';
import { SelfSetupApiService } from './self-setup-api.service';

describe('SelfSetupApiService', () => {
  it('gets the self-setup status silently (the panel shows its own state on error)', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(SelfSetupApiService);
    const http = TestBed.inject(HttpTestingController);

    const result = firstValueFrom(api.getStatus());
    const req = http.expectOne(`${environment.apiUrl}/onboarding/drafts/self-setup`);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush({ has_employee_profile: false, has_legal_entity: true, has_position: true, can_add_self: true, first_name: 'Ada', last_name: 'Owner', work_email: 'ada@acme.test' });

    expect((await result).can_add_self).toBe(true);
    http.verify();
  });
});
