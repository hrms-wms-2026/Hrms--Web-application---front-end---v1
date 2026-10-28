import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { TeamWorkingHoursApiService } from './team-working-hours-api.service';

describe('TeamWorkingHoursApiService', () => {
  let service: TeamWorkingHoursApiService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/attendance/time-tracking/team/working-hours`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TeamWorkingHoursApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('GETs this week without a weekStart', () => {
    service.getWeek().subscribe();

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ weekStart: '2026-10-26', weekEnd: '2026-11-01', days: [] });
  });

  it('sends the weekStart when given', () => {
    service.getWeek('2026-10-19').subscribe();

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('weekStart')).toBe('2026-10-19');
    req.flush({ weekStart: '2026-10-19', weekEnd: '2026-10-25', days: [] });
  });
});
