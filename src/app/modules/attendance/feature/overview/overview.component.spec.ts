import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceTodayResponse } from '../../models/time-tracking.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { OverviewComponent } from './overview.component';

describe('OverviewComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(today: Partial<AttendanceTodayResponse> | null = null): Promise<ComponentFixture<OverviewComponent>> {
    await TestBed.configureTestingModule({
      imports: [OverviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: TimeTrackingStore,
          useValue: {
            today: signal(today as AttendanceTodayResponse | null), todayLoading: signal(false), actionLoading: signal(false), activeAction: signal(null),
            clockIn: vi.fn(), startBreak: vi.fn(), endBreak: vi.fn(), clockOut: vi.fn(),
            loadToday: vi.fn(() => Promise.resolve()),
            history: signal([]), historyLoading: signal(false), historyError: signal(null), loadMyHistory: vi.fn(() => Promise.resolve()),
            monthlySummary: signal(null), monthlySummaryLoading: signal(false), monthlySummaryError: signal(null), loadMonthlySummary: vi.fn(() => Promise.resolve()),
            myCorrections: signal([]), myCorrectionsLoaded: signal(true), loadMyCorrections: vi.fn(),
            myWorkAreaRequests: signal([]), myWorkAreaRequestsLoaded: signal(true), loadMyWorkAreaRequests: vi.fn(),
            canViewCoveredEmployees: signal(false)
          }
        }
      ]
    }).compileComponents();

    return TestBed.createComponent(OverviewComponent);
  }

  it('calls loadToday on initialization', async () => {
    const fixture = await setup();
    const store = TestBed.inject(TimeTrackingStore);
    fixture.detectChanges();
    expect(store.loadToday).toHaveBeenCalled();
  });

  it('renders the status card, weekly trend, monthly health, and requests summary', async () => {
    const fixture = await setup();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-attendance-status-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-trend-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-monthly-health-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-requests-summary-card')).toBeTruthy();
  });

  it('renders a quick link to Time Tracking', async () => {
    const fixture = await setup();
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="quick-link-time-tracking"]');
    expect(link.getAttribute('href')).toContain('/attendance/time-tracking');
  });

  it('shows a greeting, the full weekday date, and the status pill above the hero', async () => {
    const fixture = await setup({
      workDate: '2026-09-08',
      timezone: 'UTC',
      attendanceStatus: 'working',
      attendanceStatusLabel: null,
      allowedClockInMethods: { web: true, desktopTray: false, biometric: false, photoRequired: false, locationRequired: false, allowedRadiusMeters: null }
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Tuesday, September 8, 2026');
    expect(text).toMatch(/Good morning|Good afternoon|Good evening/);
    expect(fixture.nativeElement.querySelector('.status-pill')?.textContent).toContain('Working');
  });

  it('renders the shared status card without its own header, since the greeting row owns it here', async () => {
    const fixture = await setup({
      workDate: '2026-09-08',
      timezone: 'UTC',
      attendanceStatus: 'not_clocked_in',
      totalWorkedMinutes: 0,
      allowedClockInMethods: { web: true, desktopTray: false, biometric: false, photoRequired: false, locationRequired: false, allowedRadiusMeters: null }
    });
    fixture.detectChanges();
    // showHeader=false means the card's own #status-card-heading (its internal date+pill
    // row) never renders - only the page-level greeting's date/status appear.
    expect(fixture.nativeElement.querySelector('#status-card-heading')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-attendance-status-card .status-card-stats')).toBeTruthy();
  });

  it('does not render a New request button in the header', async () => {
    const fixture = await setup();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="overview-new-request"]')).toBeNull();
  });

  it('shows the My/Team toggle only for someone with covered employees, and "Team" links to Time Tracking', async () => {
    const base: Partial<AttendanceTodayResponse> = {
      workDate: '2026-09-08',
      timezone: 'UTC',
      attendanceStatus: 'not_clocked_in',
      allowedClockInMethods: { web: true, desktopTray: false, biometric: false, photoRequired: false, locationRequired: false, allowedRadiusMeters: null }
    };
    const withoutTeam = await setup({ ...base, canViewCoveredEmployees: false });
    withoutTeam.detectChanges();
    expect(withoutTeam.nativeElement.querySelector('.attendance-view-toggle')).toBeNull();

    TestBed.resetTestingModule();
    const withTeam = await setup({ ...base, canViewCoveredEmployees: true });
    withTeam.detectChanges();
    const teamLink: HTMLAnchorElement = withTeam.nativeElement.querySelector('[data-testid="overview-team-toggle"]');
    expect(teamLink.getAttribute('href')).toContain('/attendance/time-tracking');
    expect(teamLink.getAttribute('href')).toContain('view=team');
  });

  it('renders Request correction and View schedule quick links to real destinations', async () => {
    const fixture = await setup();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    const correctionLink = host.querySelector<HTMLAnchorElement>('[data-testid="quick-link-request-correction"]')!;
    expect(correctionLink.getAttribute('href')).toContain('/attendance/time-tracking');
    expect(correctionLink.getAttribute('href')).toContain('openCorrection=today');

    const scheduleLink = host.querySelector<HTMLAnchorElement>('[data-testid="quick-link-schedule"]')!;
    expect(scheduleLink.getAttribute('href')).toContain('/attendance/time-tracking');
  });
});
