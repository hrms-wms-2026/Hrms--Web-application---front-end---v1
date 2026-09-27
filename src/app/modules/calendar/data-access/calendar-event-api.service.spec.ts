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

  it('respond posts { responseStatus, reason, nomineeEmployeeId } to {eventId}/respond', () => {
    service.respond('event-1', 'Accepted').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/respond`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ responseStatus: 'Accepted', reason: null, nomineeEmployeeId: null });
    req.flush(null);
  });

  it('respond forwards a reason and nominee when provided', () => {
    service.respond('event-1', 'ReplacementNominated', null, 'emp-2').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/respond`);
    expect(req.request.body).toEqual({ responseStatus: 'ReplacementNominated', reason: null, nomineeEmployeeId: 'emp-2' });
    req.flush(null);
  });

  it('getEligibleNominees requests {eventId}/eligible-nominees', () => {
    service.getEligibleNominees('event-1').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/eligible-nominees`);
    expect(req.request.method).toBe('GET');
    req.flush({ nominees: [] });
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

  it('createMeeting posts to {eventId}/meeting', () => {
    service.createMeeting('event-1', 'zoom').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/meeting`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ provider: 'zoom' });
    req.flush({ joinUrl: 'https://us05web.zoom.us/j/123' });
  });

  it('removeMeeting deletes {eventId}/meeting', () => {
    service.removeMeeting('event-1').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/meeting`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getMeetingAttendance requests {eventId}/meeting/attendance', () => {
    service.getMeetingAttendance('event-1').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/meeting/attendance`);
    expect(req.request.method).toBe('GET');
    req.flush({ available: false, attendees: [] });
  });

  it('addParticipants posts to {eventId}/participants', () => {
    service.addParticipants('event-1', ['emp-1', 'emp-2']).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/participants`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ employeeIds: ['emp-1', 'emp-2'] });
    req.flush({ participants: [] });
  });

  it('removeParticipant deletes {eventId}/participants/{employeeId}', () => {
    service.removeParticipant('event-1', 'emp-1').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/participants/emp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
