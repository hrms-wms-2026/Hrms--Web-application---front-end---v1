import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceHistoryRow } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { WorkPatternApiService } from '../../data-access/work-pattern-api.service';
import { WorkPatternDay, WorkPatternResponse } from '../../models/work-pattern.model';
import { WorkPatternCardComponent } from './work-pattern-card.component';

function day(
  date: string,
  focusMinutes: number,
  meetingMinutes: number,
  adminMinutes: number,
  idleMinutes: number
): WorkPatternDay {
  return { date, focusMinutes, meetingMinutes, adminMinutes, idleMinutes };
}

function historyRow(totalWorkedMinutes: number): AttendanceHistoryRow {
  return {
    attendanceRecordId: `record-${totalWorkedMinutes}`,
    workDate: '2026-08-24',
    employee: null,
    clockInAt: null,
    clockOutAt: null,
    isActive: false,
    breakMinutes: 0,
    totalWorkedMinutes,
    expectedWorkMode: null,
    attendanceSource: null,
    status: 'present',
    canViewDetails: false,
    canRequestCorrection: false,
    canRequestWorkAreaChange: false,
    canCorrect: false
  };
}

type StoreMock = {
  history: ReturnType<typeof signal<readonly AttendanceHistoryRow[]>>;
  historyLoading: ReturnType<typeof signal<boolean>>;
  historyError: ReturnType<typeof signal<string | null>>;
  loadMyHistory: ReturnType<typeof vi.fn>;
};

describe('WorkPatternCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    response: WorkPatternResponse | 'error' = { days: [] },
    history: readonly AttendanceHistoryRow[] = [historyRow(1560)] // 26h, matching the reference design's example
  ): Promise<{
    fixture: ComponentFixture<WorkPatternCardComponent>;
    getMyWorkPattern: ReturnType<typeof vi.fn>;
    store: StoreMock;
  }> {
    const getMyWorkPattern = vi.fn(() =>
      response === 'error' ? throwError(() => new Error('network error')) : of(response)
    );
    const store: StoreMock = {
      history: signal(history),
      historyLoading: signal(false),
      historyError: signal(null),
      loadMyHistory: vi.fn(() => Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [WorkPatternCardComponent],
      providers: [
        { provide: WorkPatternApiService, useValue: { getMyWorkPattern } },
        { provide: TimeTrackingStore, useValue: store }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkPatternCardComponent);
    fixture.detectChanges();
    return { fixture, getMyWorkPattern, store };
  }

  it('loads the current week work pattern and attendance history on init', async () => {
    const { getMyWorkPattern, store } = await setup();
    expect(getMyWorkPattern).toHaveBeenCalledOnce();
    expect(store.loadMyHistory).toHaveBeenCalledOnce();
    const [from, to] = getMyWorkPattern.mock.calls[0];
    expect(from <= to).toBe(true);
  });

  it('shows weekly worked hours from attendance history and productive hours as the sum of the three active categories', async () => {
    const { fixture } = await setup({
      days: [day('2026-08-24', 800, 370, 120, 105)] // 13h20m focus, 6h10m meeting, 2h admin, 1h45m idle
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('26h'); // weekly worked hours, from attendance history
    expect(text).toContain('21h 30m'); // productive = 800 + 370 + 120 = 1290 min
  });

  it('sizes segments as a percentage of weekly worked minutes, not the monitoring total', async () => {
    const { fixture } = await setup({
      days: [day('2026-08-24', 800, 370, 120, 105)]
    });
    const focus: HTMLElement = fixture.nativeElement.querySelector('[data-segment-type="focus"]');
    // 800 / 1560 = 51.3%
    expect(focus.style.width).toBe('51.28205128205128%');
  });

  it('renders a segment for every non-zero category and omits zero-minute categories', async () => {
    const { fixture } = await setup({
      days: [day('2026-08-24', 800, 0, 0, 0)]
    });
    const segments = fixture.nativeElement.querySelectorAll('[data-testid="work-pattern-segment"]');
    expect(segments.length).toBe(1);
    expect(segments[0].getAttribute('data-segment-type')).toBe('focus');
  });

  it('falls back to an empty bar when the request fails', async () => {
    const { fixture } = await setup('error');
    const segments = fixture.nativeElement.querySelectorAll('[data-testid="work-pattern-segment"]');
    expect(segments.length).toBe(0);
  });

  it('shows no segments when there is no attendance history yet', async () => {
    const { fixture } = await setup({ days: [day('2026-08-24', 800, 0, 0, 0)] }, []);
    const segments = fixture.nativeElement.querySelectorAll('[data-testid="work-pattern-segment"]');
    expect(segments.length).toBe(0);
  });
});
