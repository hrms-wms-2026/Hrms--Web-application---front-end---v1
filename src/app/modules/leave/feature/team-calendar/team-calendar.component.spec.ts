import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { TeamCalendarComponent } from './team-calendar.component';

describe('TeamCalendarComponent', () => {
  let fixture: ComponentFixture<TeamCalendarComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TeamCalendarComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeamCalendarComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads the current month on init', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush({ year: 2026, month: 9, monthStart: '2026-09-01', monthEnd: '2026-09-30', includesTentativeBlocks: false, isEmpty: true, days: [] });
  });

  it('opens the day detail when a day is clicked', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush({
      year: 2026, month: 9, monthStart: '2026-09-01', monthEnd: '2026-09-30', includesTentativeBlocks: false, isEmpty: false,
      days: [{ date: '2026-09-10', dayOfWeek: 'Thursday', absences: [], holidays: [] }]
    });
    await Promise.resolve();
    fixture.componentInstance.onDayClicked('2026-09-10');
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    expect(fixture.componentInstance.selectedDay()?.date).toBe('2026-09-10');
  });

  it('opens the new-request wizard for a calendar day', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush({
      year: 2026, month: 9, monthStart: '2026-09-01', monthEnd: '2026-09-30', includesTentativeBlocks: false, isEmpty: false,
      days: [{ date: '2026-09-10', dayOfWeek: 'Thursday', absences: [], holidays: [] }]
    });
    await Promise.resolve();
    fixture.componentInstance.onRequestLeave('2026-09-10');
    expect(fixture.componentInstance.wizardOpen()).toBe(true);
    expect(fixture.componentInstance.requestDate()).toBe('2026-09-10');
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    httpMock.expectOne((r) => r.url.startsWith(`${environment.apiUrl}/leave/balances/my`)).flush([]);
  });
});
