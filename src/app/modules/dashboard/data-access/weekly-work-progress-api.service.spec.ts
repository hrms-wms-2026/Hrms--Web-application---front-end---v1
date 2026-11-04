import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { WeeklyWorkProgressApiService } from './weekly-work-progress-api.service';

describe('WeeklyWorkProgressApiService', () => {
  let service: WeeklyWorkProgressApiService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/work/my-weekly-progress`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WeeklyWorkProgressApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('GETs the current week with no query params', () => {
    service.get().subscribe();

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });

  it('sends weekStart when a week is asked for', () => {
    service.get('2026-10-19').subscribe();

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('weekStart')).toBe('2026-10-19');
    req.flush({});
  });
});
