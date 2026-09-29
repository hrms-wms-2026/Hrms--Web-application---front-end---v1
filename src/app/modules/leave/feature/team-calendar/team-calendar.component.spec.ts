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
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/work-window`).flush({
      workStartTime: '09:00', workEndTime: '18:00', breakDurationMinutes: 60, timezone: 'UTC'
    });
  });

  it('loads holidays when the holiday admin is opened', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush({
      year: 2026, month: 9, monthStart: '2026-09-01', monthEnd: '2026-09-30', includesTentativeBlocks: false, isEmpty: true, days: []
    });
    fixture.componentInstance.openHolidays();
    expect(fixture.componentInstance.holidayOpen()).toBe(true);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/holidays`).flush([]);
  });

  it('saves a holiday then reloads the month', async () => {
    const emptyMonth = {
      year: 2026, month: 9, monthStart: '2026-09-01', monthEnd: '2026-09-30', includesTentativeBlocks: false, isEmpty: true, days: []
    };
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush(emptyMonth);
    const saving = fixture.componentInstance.onSaveHoliday({ name: 'Founders Day', date: '2026-09-10', endDate: null });
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/holidays` && r.method === 'POST').flush({
      id: 'h1', name: 'Founders Day', date: '2026-09-10', endDate: '2026-09-10'
    });
    let holidaysReloaded = false;
    let calendarReloaded = false;
    for (let i = 0; i < 12 && (!holidaysReloaded || !calendarReloaded); i++) {
      for (const req of httpMock.match((r) => r.url === `${environment.apiUrl}/leave/holidays` && r.method === 'GET')) {
        req.flush([]);
        holidaysReloaded = true;
      }
      for (const req of httpMock.match((r) => r.url === `${environment.apiUrl}/leave/calendar`)) {
        req.flush(emptyMonth);
        calendarReloaded = true;
      }
      if (!holidaysReloaded || !calendarReloaded) await Promise.resolve();
    }
    expect(holidaysReloaded).toBe(true);
    expect(calendarReloaded).toBe(true);
    await saving;
  });
});
