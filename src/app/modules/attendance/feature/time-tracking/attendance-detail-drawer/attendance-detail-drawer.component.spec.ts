import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceDayDetail, AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { AttendanceDetailDrawerComponent, AttendanceDetailSelection } from './attendance-detail-drawer.component';

const detail: AttendanceDayDetail = {
  summary: {
    attendanceRecordId: 'record-1',
    workDate: '2026-08-27',
    employee: null,
    clockInAt: '2026-08-27T04:00:00Z',
    clockOutAt: '2026-08-27T12:30:00Z',
    isActive: false,
    breakMinutes: 45,
    totalWorkedMinutes: 465,
    expectedWorkMode: 'onsite',
    attendanceSource: 'web',
    status: 'clocked_out',
    canViewDetails: true,
    canRequestCorrection: true,
    canRequestWorkAreaChange: false,
    canCorrect: false,
    statusLabel: 'Clocked out'
  },
  timelineEvents: [
    { eventType: 'ClockIn', timestamp: '2026-08-27T04:00:00Z', source: 'web' },
    { eventType: 'ClockOut', timestamp: '2026-08-27T12:30:00Z', source: 'web' }
  ],
  dailyActivity: {
    totalActiveMinutes: 200,
    totalIdleMinutes: 40,
    totalMeetingMinutes: 30,
    activePercentage: 83,
    activityScore: 91,
    dataCoveragePercentage: 95,
    topApps: [{ appName: 'VS Code', totalSeconds: 3600, category: 'productive' }]
  },
  checkIns: [
    {
      id: 'checkin-1',
      checkedInAt: '2026-08-27T04:01:00Z',
      latitude: 6.9271,
      longitude: 79.8612,
      locationAccuracy: 12.5,
      locationAddress: 'Colombo Office'
    }
  ]
};

interface DrawerStoreMock {
  dayDetail: ReturnType<typeof signal<AttendanceDayDetail | null>>;
  dayDetailLoading: ReturnType<typeof signal<boolean>>;
  dayDetailError: ReturnType<typeof signal<string | null>>;
  loadDayDetail: ReturnType<typeof vi.fn>;
  refreshDayDetail: ReturnType<typeof vi.fn>;
  clearDayDetail: ReturnType<typeof vi.fn>;
}

describe('AttendanceDetailDrawerComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    selection?: AttendanceDetailSelection | null;
    data?: AttendanceDayDetail | null;
    loading?: boolean;
    error?: string | null;
    fallbackSummary?: AttendanceHistoryRow | null;
  } = {}): Promise<{ fixture: ComponentFixture<AttendanceDetailDrawerComponent>; store: DrawerStoreMock }> {
    const store: DrawerStoreMock = {
      dayDetail: signal(options.data ?? null),
      dayDetailLoading: signal(options.loading ?? false),
      dayDetailError: signal(options.error ?? null),
      loadDayDetail: vi.fn(() => Promise.resolve()),
      refreshDayDetail: vi.fn(() => Promise.resolve()),
      clearDayDetail: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AttendanceDetailDrawerComponent],
      providers: [{ provide: TimeTrackingStore, useValue: store }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceDetailDrawerComponent);
    fixture.componentRef.setInput('selection', options.selection === undefined ? { employeeId: 'employee-1', workDate: '2026-08-27' } : options.selection);
    fixture.componentRef.setInput('fallbackSummary', options.fallbackSummary ?? null);
    fixture.componentRef.setInput('displayTimezone', 'UTC');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  it('shows the tray label for both onevo.agent.trayapp and crownus.agent.trayapp', async () => {
    // Activity recorded before the rename keeps the old process name.
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    expect(component.appLabel('onevo.agent.trayapp.exe')).toBe('WorkPulse');
    expect(component.appLabel('crownus.agent.trayapp.exe')).toBe('WorkPulse');
  });

  it('requests the detail for the given selection on open', async () => {
    const { store } = await setup();
    expect(store.loadDayDetail).toHaveBeenCalledWith('employee-1', '2026-08-27');
  });

  it('renders nothing when there is no selection', async () => {
    const { fixture, store } = await setup({ selection: null });
    expect((fixture.nativeElement as HTMLElement).querySelector('.drawer-panel')).toBeNull();
    expect(store.loadDayDetail).not.toHaveBeenCalled();
  });

  it('shows Working beside the date when the shift is still active', async () => {
    const { fixture } = await setup({
      data: {
        ...detail,
        summary: { ...detail.summary, status: 'active', statusLabel: 'Working', clockOutAt: null }
      }
    });
    const pill = (fixture.nativeElement as HTMLElement).querySelector('.drawer-date-row .status-pill');

    expect(pill?.classList.contains('status-pill--active')).toBe(true);
    expect(pill?.textContent).toContain('Working');
    expect((fixture.nativeElement as HTMLElement).querySelector('.summary-tile--status')).toBeNull();
  });

  it('renders the loading state', async () => {
    const { fixture } = await setup({ loading: true });
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders a retryable error state', async () => {
    const { fixture } = await setup({ error: 'Could not load attendance details. Try again.' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load attendance details. Try again.');
  });

  it('renders the history-row summary when the detail endpoint cannot find a record', async () => {
    const { fixture } = await setup({ error: 'The requested record could not be found.', fallbackSummary: detail.summary });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Summary');
    expect(text).toContain('Clock in');
    expect(text).toContain('Worked time');
    expect(text).toContain('The requested record could not be found.');
    expect(text).toContain('Basic attendance summary is shown above. Detailed timeline and activity are unavailable.');
  });

  it('renders summary, timeline, daily activity, and check-in location sections when data loads', async () => {
    const { fixture } = await setup({ data: detail });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Summary');
    expect(text).toContain('Timeline');
    expect(text).toContain('Daily activity');
    expect(text).toContain('Clocked in');
    expect(text).toContain('Clocked out');
    expect(text).toContain('VS Code');
    expect(text).toContain('Apps used');
    expect(text).toContain('No activity checks for this day.');
    expect(text).toContain('1h');
    expect(text).not.toContain('Active time');
    expect(text).toContain('Activity score');
    expect(text).toContain('91');
    expect(text).toContain('/ 100');
    expect(text).toContain('Location check-ins');
    expect(text).toContain('Colombo Office');
  });

  it('shows Allow, Skip, and No response for idle activity checks', async () => {
    const { fixture } = await setup({
      data: {
        ...detail,
        activityChecks: [
          { id: 'allow', promptedAt: '2026-08-27T04:15:00Z', outcome: 'captured', url: 'https://files.example/shot.jpg' },
          { id: 'skip', promptedAt: '2026-08-27T05:15:00Z', outcome: 'declined', url: null },
          { id: 'miss', promptedAt: '2026-08-27T06:15:00Z', outcome: 'timed_out', url: null }
        ]
      }
    });
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(text).toContain('Allow');
    expect(text).toContain('Skip');
    expect(text).toContain('Nothing done');
    expect(text).not.toContain('No activity checks for this day.');
    expect(root.querySelector('img')?.getAttribute('src')).toBe('https://files.example/shot.jpg');
  });

  it('shows "Were you working?" answers for employees without screenshot capture', async () => {
    const { fixture } = await setup({
      data: {
        ...detail,
        activityChecks: [
          { id: 'yes', promptedAt: '2026-08-27T04:15:00Z', outcome: 'confirmed_working', url: null },
          { id: 'no', promptedAt: '2026-08-27T05:15:00Z', outcome: 'not_working', url: null }
        ]
      }
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Was working');
    expect(text).toContain('Not working');
    expect(text).not.toContain('No activity checks for this day.');
  });

  it('renders a friendly empty state when daily activity is null', async () => {
    const { fixture } = await setup({ data: { ...detail, dailyActivity: null } });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No activity checks for this day.');
  });

  it('renders a friendly empty state when there are no check-ins', async () => {
    const { fixture } = await setup({ data: { ...detail, checkIns: [] } });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No check-in locations recorded for this day.');
  });

  it('falls back to coordinates when a check-in has no resolved address', async () => {
    const { fixture } = await setup({
      data: { ...detail, checkIns: [{ ...detail.checkIns[0], locationAddress: null }] }
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('6.92710, 79.86120 (±13 m)');
  });

  it('emits closed when the close button is clicked', async () => {
    const { fixture } = await setup({ data: detail });
    const emitted = vi.fn();
    fixture.componentInstance.closed.subscribe(emitted);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.drawer-close')!.click();
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('emits requestCorrection with the summary row when canRequestCorrection is true', async () => {
    const { fixture } = await setup({ data: detail });
    const emitted = vi.fn();
    fixture.componentInstance.requestCorrection.subscribe(emitted);

    fixture.componentInstance.emitRequestCorrection();

    expect(emitted).toHaveBeenCalledWith(detail.summary);
  });

  it('does not render a Request correction button when canRequestCorrection is false', async () => {
    const { fixture } = await setup({ data: { ...detail, summary: { ...detail.summary, canRequestCorrection: false } } });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Request correction');
  });

  it('emits requestCorrection using the fallback summary when the detail request has not loaded', async () => {
    const { fixture, store } = await setup({ error: 'The requested record could not be found.', fallbackSummary: detail.summary });
    expect(store.dayDetail()).toBeNull();
    const emitted = vi.fn();
    fixture.componentInstance.requestCorrection.subscribe(emitted);

    fixture.componentInstance.emitRequestCorrection();

    expect(emitted).toHaveBeenCalledWith(detail.summary);
  });
});
