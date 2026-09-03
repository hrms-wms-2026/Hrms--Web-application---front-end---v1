import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { ActivityTimelinePageComponent } from './activity-timeline-page.component';

function makeToday(overrides: Partial<AttendanceTodayResponse> = {}): AttendanceTodayResponse {
  return {
    attendanceStatus: 'clocked_in',
    attendanceStatusLabel: 'Clocked in',
    clockInAt: '2026-08-27T09:00:00Z',
    clockOutAt: null,
    totalWorkedMinutes: 120,
    breaks: [],
    canClockIn: false,
    canClockOut: true,
    canStartBreak: true,
    canEndBreak: false,
    allowedClockInMethods: { desktopTray: false, webManual: true },
    ...overrides
  } as AttendanceTodayResponse;
}

describe('ActivityTimelinePageComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(today: AttendanceTodayResponse | null): Promise<{
    fixture: import('@angular/core/testing').ComponentFixture<ActivityTimelinePageComponent>;
  }> {
    const store = {
      today: signal(today),
      todayLoading: signal(false),
      loadToday: () => Promise.resolve()
    };

    await TestBed.configureTestingModule({
      imports: [ActivityTimelinePageComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivityTimelineApiService, useValue: { getMyTimeline: () => of({ date: '2026-08-27', segments: [] }) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ActivityTimelinePageComponent);
    fixture.detectChanges();
    return { fixture };
  }

  it('renders a back-to-home link and the page title', async () => {
    const { fixture } = await setup(makeToday());
    expect(fixture.nativeElement.querySelector('[data-testid="back-to-home-link"]').getAttribute('href')).toBe('/dashboard');
    expect((fixture.nativeElement.textContent as string)).toContain('Activity Timeline');
  });

  it('shows the empty state when the employee has not clocked in today', async () => {
    const { fixture } = await setup(makeToday({ clockInAt: null }));
    expect(fixture.nativeElement.querySelector('[data-testid="activity-timeline-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="activity-timeline-bar"]')).toBeNull();
  });

  it('renders the timeline bar and legend when clocked in', async () => {
    const { fixture } = await setup(makeToday());
    expect(fixture.nativeElement.querySelector('[data-testid="activity-timeline-bar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="activity-timeline-legend"]')).not.toBeNull();
  });
});
