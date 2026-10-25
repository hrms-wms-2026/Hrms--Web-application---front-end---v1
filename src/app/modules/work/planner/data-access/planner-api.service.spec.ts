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
  ];

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

  it('maps every planner error code to copy, with a fallback', () => {
    for (const code of ['planner_disabled', 'planner_not_today', 'planner_block_overlap', 'planner_task_not_plannable',
      'planner_invalid_time', 'planner_not_found']) {
      expect(plannerErrorMessage(code)).not.toBe(plannerErrorMessage(undefined));
    }
    expect(plannerErrorMessage('planner_block_overlap')).toBe('This overlaps another planned block.');
  });
});
