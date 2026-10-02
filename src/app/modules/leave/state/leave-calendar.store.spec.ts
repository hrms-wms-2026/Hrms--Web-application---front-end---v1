import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveCalendarMonthResponse } from '../models/leave-calendar.model';
import { LeaveCalendarStore } from './leave-calendar.store';

describe('LeaveCalendarStore', () => {
  let store: InstanceType<typeof LeaveCalendarStore>;
  let httpMock: HttpTestingController;

  const month: LeaveCalendarMonthResponse = {
    year: 2026, month: 9, monthStart: '2026-09-01', monthEnd: '2026-09-30',
    includesTentativeBlocks: false, isEmpty: false, days: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveCalendarStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveCalendarStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts on the current year and month', () => {
    const now = new Date();
    expect(store.year()).toBe(now.getFullYear());
    expect(store.monthNumber()).toBe(now.getMonth() + 1);
  });

  it('loads the current month', async () => {
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush(month);
    await loading;
    expect(store.month()).toEqual(month);
    expect(store.loading()).toBe(false);
  });

  it('goToPreviousMonth decrements the month and reloads', async () => {
    store.setState(2026, 1);
    const loading = store.goToPreviousMonth();
    expect(store.year()).toBe(2025);
    expect(store.monthNumber()).toBe(12);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush(month);
    await loading;
  });

  it('goToNextMonth increments the month and reloads', async () => {
    store.setState(2026, 12);
    const loading = store.goToNextMonth();
    expect(store.year()).toBe(2027);
    expect(store.monthNumber()).toBe(1);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush(month);
    await loading;
  });

  it('setDepartmentFilter reloads with the new filter', async () => {
    const loading = store.setDepartmentFilter('dept-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/calendar?year=${store.year()}&month=${store.monthNumber()}&departmentId=dept-1`).flush(month);
    await loading;
    expect(store.departmentId()).toBe('dept-1');
  });

  it('setIncludeTentative reloads with includeTentative=true', async () => {
    const loading = store.setIncludeTentative(true);
    httpMock.expectOne(`${environment.apiUrl}/leave/calendar?year=${store.year()}&month=${store.monthNumber()}&includeTentative=true`).flush(month);
    await loading;
    expect(store.includeTentative()).toBe(true);
  });

  it('sets error when load fails', async () => {
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await loading;
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('goToToday resets to the current month and reloads', async () => {
    store.setState(2020, 1);
    const now = new Date();
    const loading = store.goToToday();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/calendar`).flush(month);
    await loading;
    expect(store.year()).toBe(now.getFullYear());
    expect(store.monthNumber()).toBe(now.getMonth() + 1);
  });
});
