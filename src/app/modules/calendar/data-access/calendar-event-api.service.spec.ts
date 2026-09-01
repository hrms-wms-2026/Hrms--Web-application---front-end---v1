import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CalendarEventApiService } from './calendar-event-api.service';

describe('CalendarEventApiService', () => {
  let service: CalendarEventApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CalendarEventApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CalendarEventApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getEvents requests the date range as query params', () => {
    service.getEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z').subscribe();
    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/calendar` && r.params.get('from') === '2026-09-01T00:00:00Z' && r.params.get('to') === '2026-09-30T00:00:00Z'
    );
    req.flush({ events: [] });
  });

  it('create posts to the base url', () => {
    service.create({
      title: 'Standup', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      isAllDay: false, location: null, meetingLink: null, color: null,
      recurrence: 'none', participantEmployeeIds: [], recurrenceRule: null
    }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('editOccurrence puts to {masterId}/occurrence', () => {
    service.editOccurrence('master-1', {
      originalStart: '2026-09-08T09:00:00Z', scope: 'ThisEventOnly', title: 'X', description: null,
      startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z', isAllDay: false,
      location: null, meetingLink: null, color: null
    }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/master-1/occurrence`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('cancelOccurrence deletes {masterId}/occurrence with originalStart as a query param', () => {
    service.cancelOccurrence('master-1', '2026-09-15T09:00:00Z').subscribe();
    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/calendar/master-1/occurrence` && r.params.get('originalStart') === '2026-09-15T09:00:00Z'
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('respond posts { responseStatus } to {eventId}/respond', () => {
    service.respond('event-1', 'Accepted').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/respond`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ responseStatus: 'Accepted' });
    req.flush(null);
  });

  it('getMyTimezone requests my-timezone', () => {
    service.getMyTimezone().subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/my-timezone`);
    expect(req.request.method).toBe('GET');
    req.flush({ timezone: 'Asia/Colombo' });
  });

  it('checkConflicts posts to check-conflicts', () => {
    service.checkConflicts({ participantEmployeeIds: ['emp-1'], startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T10:00:00Z' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/check-conflicts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ participantEmployeeIds: ['emp-1'], startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T10:00:00Z' });
    req.flush({ conflicts: [] });
  });
});
