import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../../core/interceptors/error.interceptor';
import { plannerErrorMessage } from '../utils/planner-error-messages';
import { PlannerApiService } from './planner-api.service';

describe('PlannerApiService', () => {
  let service: PlannerApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/planner`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlannerApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlannerApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const cases: [string, (s: PlannerApiService) => Observable<unknown>, string, string][] = [
    ['getMyDay', (s) => s.getMyDay('2026-11-02'), 'GET', `${base}/me`],
    ['getEmployeeDay', (s) => s.getEmployeeDay('e1', null), 'GET', `${base}/employees/e1`],
    ['createBlock', (s) => s.createBlock({ taskId: 't1', startAt: 'a', endAt: 'b' }), 'POST', `${base}/me/blocks`],
    ['moveBlock', (s) => s.moveBlock('b1', { startAt: 'a', endAt: 'b' }), 'PATCH', `${base}/me/blocks/b1`],
    ['deleteBlock', (s) => s.deleteBlock('b1'), 'DELETE', `${base}/me/blocks/b1`],
    ['getRange', (s) => s.getRange('2026-11-02', '2026-11-08'), 'GET', `${base}/me/range`],
    ['getFocus', (s) => s.getFocus(), 'GET', `${base}/me/focus`],
    ['getTeamDay', (s) => s.getTeamDay(null, null), 'GET', `${base}/team`],
    ['getTeamRange', (s) => s.getTeamRange('2026-11-02', '2026-11-08', null), 'GET', `${base}/team/range`],
    ['getEmployeeRange', (s) => s.getEmployeeRange('e1', '2026-11-02', '2026-11-08'), 'GET', `${base}/employees/e1/range`],
  ];

  // Team planner (2026-11-03).
  it('team reads send date, range and managerId only when given', () => {
    service.getTeamDay('2026-11-05', 'm1').subscribe();
    const day = http.expectOne((r) => r.url === `${base}/team`).request.params;
    expect([day.get('date'), day.get('managerId')]).toEqual(['2026-11-05', 'm1']);
    service.getTeamDay(null, null).subscribe();
    const bare = http.expectOne((r) => r.url === `${base}/team`).request.params;
    expect([bare.has('date'), bare.has('managerId')]).toEqual([false, false]);
    service.getTeamRange('2026-11-02', '2026-11-08', null).subscribe();
    const range = http.expectOne((r) => r.url === `${base}/team/range`).request.params;
    expect([range.get('from'), range.get('to'), range.has('managerId')]).toEqual(['2026-11-02', '2026-11-08', false]);
    service.getEmployeeRange('e1', '2026-11-02', '2026-11-08').subscribe();
    const person = http.expectOne((r) => r.url === `${base}/employees/e1/range`).request.params;
    expect([person.get('from'), person.get('to')]).toEqual(['2026-11-02', '2026-11-08']);
  });

  it.each(cases)('%s calls its route and leaves its errors to the caller', (_name, call, method, url) => {
    call(service).subscribe({ error: () => undefined });
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe(method);
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush(null);
  });

  it('getMyDay sends the date only when given', () => {
    service.getMyDay('2026-11-02').subscribe();
    expect(http.expectOne((r) => r.url === `${base}/me`).request.params.get('date')).toBe('2026-11-02');
    service.getMyDay(null).subscribe();
    expect(http.expectOne((r) => r.url === `${base}/me`).request.params.has('date')).toBe(false);
  });

  it('getRange sends from and to', () => {
    service.getRange('2026-11-02', '2026-11-08').subscribe();
    const params = http.expectOne((r) => r.url === `${base}/me/range`).request.params;
    expect([params.get('from'), params.get('to')]).toEqual(['2026-11-02', '2026-11-08']);
  });

  it('has copy for the v1.1 codes', () => {
    expect(plannerErrorMessage('planner_day_read_only')).toBe("Past days can't be changed.");
    expect(plannerErrorMessage('planner_beyond_horizon')).toBe('You can plan up to 28 days ahead.');
    expect(plannerErrorMessage('planner_invalid_range')).toBe('That range is too long to show.');
  });

  it('maps every planner error code to copy, with a fallback', () => {
    for (const code of ['planner_disabled', 'planner_not_today', 'planner_block_overlap', 'planner_task_not_plannable',
      'planner_invalid_time', 'planner_not_found']) {
      expect(plannerErrorMessage(code)).not.toBe(plannerErrorMessage(undefined));
    }
    expect(plannerErrorMessage('planner_block_overlap')).toBe('This overlaps another planned block.');
  });

  it('getRange asks for a principal\'s days only when forEmployeeId is given', () => {
    service.getRange('2026-11-10', '2026-11-16').subscribe();
    expect(http.expectOne((r) => r.url === `${base}/me/range`).request.params.has('forEmployeeId')).toBe(false);

    service.getRange('2026-11-10', '2026-11-16', 'ceo').subscribe();
    expect(http.expectOne((r) => r.url === `${base}/me/range`).request.params.get('forEmployeeId')).toBe('ceo');
  });

  it('focus and block writes act for a principal only when forEmployeeId is given', () => {
    const forParam = (url: string) => http.expectOne((r) => r.url === url).request.params.get('forEmployeeId');

    service.getFocus().subscribe();
    expect(forParam(`${base}/me/focus`)).toBeNull();
    service.getFocus('ceo').subscribe();
    expect(forParam(`${base}/me/focus`)).toBe('ceo');

    service.createBlock({ taskId: 't1', startAt: 'a', endAt: 'b' }, 'ceo').subscribe();
    expect(forParam(`${base}/me/blocks`)).toBe('ceo');
    service.moveBlock('b1', { startAt: 'a', endAt: 'b', expectedVersion: 'v1' }, 'ceo').subscribe();
    const move = http.expectOne((r) => r.url === `${base}/me/blocks/b1`);
    expect([move.request.params.get('forEmployeeId'), move.request.body.expectedVersion]).toEqual(['ceo', 'v1']);
  });

  it('deleteBlock sends expectedVersion and forEmployeeId as query parameters only when given', () => {
    service.deleteBlock('b1').subscribe();
    expect(http.expectOne((r) => r.url === `${base}/me/blocks/b1`).request.params.keys()).toEqual([]);

    service.deleteBlock('b1', 'v1', 'ceo').subscribe();
    const params = http.expectOne((r) => r.url === `${base}/me/blocks/b1`).request.params;
    expect([params.get('expectedVersion'), params.get('forEmployeeId')]).toEqual(['v1', 'ceo']);
  });
});
