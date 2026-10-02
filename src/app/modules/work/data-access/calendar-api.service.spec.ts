import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CalendarApiService } from './calendar-api.service';

describe('CalendarApiService', () => {
  let service: CalendarApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CalendarApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CalendarApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getEvent fetches a single calendar event detail by id', () => {
    service.getEvent('event-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/calendar-events/event-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'event-1', projectId: 'p1', name: 'Release 1', color: '#2563EB', status: 'active', startDate: '2026-10-01', endDate: '2026-10-31', description: null, createdById: 'e1', createdByName: 'Priya Shankar', objectiveIds: [], taskIds: [], createdAt: '2026-10-01T00:00:00Z', archivedById: null, archivedAt: null });
  });

  it('getEventTasks fetches the tasks linked to a milestone', () => {
    service.getEventTasks('event-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/calendar-events/event-1/tasks`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getEventActivity fetches the activity log for a milestone', () => {
    service.getEventActivity('event-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/calendar-events/event-1/activity`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
