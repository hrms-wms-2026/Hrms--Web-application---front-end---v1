import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { TeamScheduleApiService } from './team-schedule-api.service';

describe('TeamScheduleApiService', () => {
  let service: TeamScheduleApiService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/planner/team`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TeamScheduleApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('GETs today without a date', () => {
    service.getTeamDay().subscribe();

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });

  it('sends a past date', () => {
    service.getTeamDay('2026-10-28').subscribe();

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('date')).toBe('2026-10-28');
    req.flush({});
  });

  it('GETs the team week for a Monday', () => {
    service.getTeamWeek('2026-10-26').subscribe();

    const req = http.expectOne((r) => r.url === `${url}/week`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('weekStart')).toBe('2026-10-26');
    req.flush({});
  });

  it('GETs the current week without weekStart', () => {
    service.getTeamWeek(null).subscribe();

    const req = http.expectOne((r) => r.url === `${url}/week`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });
});
