import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceHistoryRow } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { AttendanceTrendCardComponent } from './attendance-trend-card.component';

function row(workDate: string, totalWorkedMinutes: number): AttendanceHistoryRow {
  return {
    attendanceRecordId: `record-${workDate}`,
    workDate,
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

describe('AttendanceTrendCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(history: readonly AttendanceHistoryRow[] = []): Promise<{
    fixture: ComponentFixture<AttendanceTrendCardComponent>;
    store: StoreMock;
  }> {
    const store: StoreMock = {
      history: signal(history),
      historyLoading: signal(false),
      historyError: signal(null),
      loadMyHistory: vi.fn(() => Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [AttendanceTrendCardComponent],
      providers: [{ provide: TimeTrackingStore, useValue: store }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceTrendCardComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('loads the current week history on init', async () => {
    const { store } = await setup();
    expect(store.loadMyHistory).toHaveBeenCalledTimes(1);
    const range = store.loadMyHistory.mock.calls[0][0];
    expect(range.from <= range.to).toBe(true);
  });

  it('shows the weekly total against the 40h goal', async () => {
    const { fixture } = await setup([row('2026-08-24', 456), row('2026-08-25', 504)]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('16h');
    expect(text).toContain('40h');
  });

  it('renders one bar per day of the week', async () => {
    const { fixture } = await setup([row('2026-08-24', 456)]);
    const bars = fixture.nativeElement.querySelectorAll('[data-testid="attendance-trend-bar"]');
    expect(bars.length).toBe(7);
  });
});
