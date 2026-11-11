import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SILENT_HTTP_ERRORS } from '../../../../core/interceptors/error.interceptor';
import { MeetingsAvailabilityService } from '../state/meetings-availability.service';
import { MeetingApiService } from './meeting-api.service';

describe('MeetingApiService', () => {
  let service: MeetingApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/meetings`;
  const series = 's1';
  // Sent with an offset; the route always carries the UTC instant.
  const start = '2026-11-02T09:00:00+05:30';
  const key = encodeURIComponent('2026-11-02T03:30:00.000Z');
  const occ = `${base}/series/${series}/occurrences/${key}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MeetingApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MeetingApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const cases: [string, (s: MeetingApiService) => Observable<unknown>, string, string][] = [
    ['create', (s) => s.create({ projectId: 'p', objectiveId: 'o', title: 't', description: null, location: null, isPrivate: false,
      start, durationMinutes: 30, isAllDay: false, timezone: 'UTC', recurrenceRule: null, participantEmployeeIds: [], guestEmails: [],
      platform: null }), 'POST', base],
    ['getOccurrence', (s) => s.getOccurrence('t1'), 'GET', `${base}/occurrences/t1`],
    ['getOccurrenceAt', (s) => s.getOccurrenceAt(series, start), 'GET', occ],
    ['getSeries', (s) => s.getSeries(series), 'GET', `${base}/series/${series}`],
    ['edit', (s) => s.edit(series, start, { scope: 'this', revision: 1 }), 'PATCH', occ],
    ['cancel', (s) => s.cancel(series, start, 'all'), 'POST', `${occ}/cancel`],
    ['move', (s) => s.move(series, start, { scope: 'this', projectId: 'p', objectiveId: 'o' }), 'POST', `${occ}/move`],
    ['addSeriesAttendees', (s) => s.addSeriesAttendees(series, { employeeIds: ['e'], guestEmails: [] }), 'POST', `${base}/series/${series}/attendees`],
    ['removeSeriesEmployee', (s) => s.removeSeriesEmployee(series, 'e1'), 'DELETE', `${base}/series/${series}/attendees/employees/e1`],
    ['removeSeriesGuest', (s) => s.removeSeriesGuest(series, 'a+b@x.com'), 'DELETE',
      `${base}/series/${series}/attendees/guests/${encodeURIComponent('a+b@x.com')}`],
    ['addOccurrenceAttendees', (s) => s.addOccurrenceAttendees(series, start, { employeeIds: [], guestEmails: ['g@x.com'] }), 'POST', `${occ}/attendees`],
    ['removeOccurrenceEmployee', (s) => s.removeOccurrenceEmployee(series, start, 'e1'), 'DELETE', `${occ}/attendees/employees/e1`],
    ['removeOccurrenceGuest', (s) => s.removeOccurrenceGuest(series, start, 'g@x.com'), 'DELETE',
      `${occ}/attendees/guests/${encodeURIComponent('g@x.com')}`],
    ['respond', (s) => s.respond(series, { status: 'accepted', reason: null, originalStart: null }), 'POST', `${base}/series/${series}/respond`],
    ['getLink', (s) => s.getLink(series), 'GET', `${base}/series/${series}/link`],
    ['createLink', (s) => s.createLink(series, { platform: 'zoom', regenerate: false }), 'POST', `${base}/series/${series}/link`],
    ['retryLink', (s) => s.retryLink(series), 'POST', `${base}/series/${series}/link/retry`],
    ['removeLink', (s) => s.removeLink(series), 'DELETE', `${base}/series/${series}/link`],
    ['confirmLinkCleanup', (s) => s.confirmLinkCleanup(series), 'POST', `${base}/series/${series}/link/cleanup-confirmed`],
    ['getAttendance', (s) => s.getAttendance(series, start), 'GET', `${occ}/attendance`],
    ['recheckAttendance', (s) => s.recheckAttendance(series, start), 'POST', `${occ}/attendance/recheck`],
    ['listActionItems', (s) => s.listActionItems('t1'), 'GET', `${base}/occurrences/t1/action-items`],
    ['unlinkActionItem', (s) => s.unlinkActionItem('t1', 'a1'), 'DELETE', `${base}/occurrences/t1/action-items/a1`],
    ['bulkPreview', (s) => s.bulkPreview({ projectId: null, objectiveId: null, departmentIds: ['d'], managerEmployeeIds: [], employeeIds: [],
      seriesId: null, platform: 'zoom' }), 'POST', `${base}/bulk-preview`],
    ['listDelegates', (s) => s.listDelegates(), 'GET', `${base}/delegates`],
    ['addDelegate', (s) => s.addDelegate('e1'), 'POST', `${base}/delegates`],
    ['revokeDelegate', (s) => s.revokeDelegate('d1'), 'DELETE', `${base}/delegates/d1`],
    ['listPrincipals', (s) => s.listPrincipals(), 'GET', `${base}/delegates/principals`],
  ];

  it.each(cases)('%s calls the contract route', (_name, call, method, url) => {
    call(service).subscribe();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe(method);
    req.flush(null);
  });

  it.each(cases)('%s leaves its errors to the caller only when it writes', (_name, call, method, url) => {
    call(service).subscribe({ error: () => undefined });
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(method !== 'GET');
    req.flush(null);
  });

  it('a refused write tells the app whether meetings are off or read-only', () => {
    const availability = TestBed.inject(MeetingsAvailabilityService);
    expect(availability.canCreate()).toBe(true);

    service.cancel(series, start, 'this').subscribe({ error: () => undefined });
    http.expectOne(`${occ}/cancel`).flush({ code: 'meetings_read_only' }, { status: 409, statusText: 'Conflict' });
    expect(availability.state()).toBe('read_only');
    expect(availability.canCreate()).toBe(false);

    service.retryLink(series).subscribe({ error: () => undefined });
    http.expectOne(`${base}/series/${series}/link/retry`).flush({ code: 'meetings_disabled' }, { status: 503, statusText: 'Unavailable' });
    expect(availability.state()).toBe('disabled');
  });

  it('list sends the window and the optional project', () => {
    service.list('2026-11-01T00:00:00Z', '2026-11-08T00:00:00Z', 'p1').subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-11-01T00:00:00Z');
    expect(req.request.params.get('to')).toBe('2026-11-08T00:00:00Z');
    expect(req.request.params.get('projectId')).toBe('p1');
    req.flush([]);
  });

  it('list leaves projectId out when there is none', () => {
    service.list('2026-11-01T00:00:00Z', '2026-11-08T00:00:00Z').subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.has('projectId')).toBe(false);
    req.flush([]);
  });

  it('getOccurrenceAt encodes the original start as the UTC instant', () => {
    service.getOccurrenceAt(series, '2026-11-02T09:00:00+05:30').subscribe();
    http.expectOne(`${base}/series/s1/occurrences/2026-11-02T03%3A30%3A00.000Z`).flush({});
  });

  it('cancel sends the scope in the body', () => {
    service.cancel(series, start, 'following').subscribe();
    expect(http.expectOne(`${occ}/cancel`).request.body).toEqual({ scope: 'following' });
  });

  it('removeLink maps a 204 (there was no link) to null', () => {
    let result: unknown = 'unset';
    service.removeLink(series).subscribe((r) => (result = r));
    http.expectOne(`${base}/series/${series}/link`).flush(null, { status: 204, statusText: 'No Content' });
    expect(result).toBeNull();
  });

  it('addDelegate sends the end date only when one is given', () => {
    service.addDelegate('e1').subscribe();
    expect(http.expectOne(`${base}/delegates`).request.body).toEqual({ delegateEmployeeId: 'e1' });

    service.addDelegate('e2', '2026-12-01T00:00:00Z').subscribe();
    expect(http.expectOne(`${base}/delegates`).request.body).toEqual({ delegateEmployeeId: 'e2', expiresAt: '2026-12-01T00:00:00Z' });
  });

  it('addDelegate sends canPlanTasks only when it is on, and updateDelegate PATCHes it', () => {
    service.addDelegate('e1', undefined, true).subscribe();
    expect(http.expectOne(`${base}/delegates`).request.body).toEqual({ delegateEmployeeId: 'e1', canPlanTasks: true });

    service.updateDelegate('d1', false).subscribe();
    const req = http.expectOne(`${base}/delegates/d1`);
    expect([req.request.method, req.request.body]).toEqual(['PATCH', { canPlanTasks: false }]);
  });
});
