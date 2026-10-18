import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotificationSettingsApiService } from './notification-settings-api.service';
import { environment } from '../../../../environments/environment';

describe('NotificationSettingsApiService', () => {
  let service: NotificationSettingsApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/settings/notifications`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificationSettingsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the effective settings', () => {
    service.list().subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('saves one event override with the loaded revision', () => {
    service.update('work_approval_requested', { enabledChannels: ['in_app', 'email'], templateId: null, recipientRule: 'default', revision: 3 }).subscribe();
    const req = http.expectOne(`${base}/work_approval_requested`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ enabledChannels: ['in_app', 'email'], templateId: null, recipientRule: 'default', revision: 3 });
    req.flush({});
  });

  it('resets one event to defaults', () => {
    service.reset('work_approval_requested').subscribe();
    const req = http.expectOne(`${base}/work_approval_requested`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
