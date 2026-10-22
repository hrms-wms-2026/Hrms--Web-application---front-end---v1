import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingApiService } from '../../../attendance/data-access/time-tracking-api.service';
import { AttendanceHistoryRow, AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { WeeklyProgressCardComponent, weekRange } from './weekly-progress-card.component';

// Fixed clock: Thursday 22 October 2026, local time - nothing depends on the real date.
const NOW = new Date(2026, 9, 22, 11, 0, 0);

function row(workDate: string, totalWorkedMinutes: number): AttendanceHistoryRow {
  return { workDate, totalWorkedMinutes } as AttendanceHistoryRow;
}

function paged(items: AttendanceHistoryRow[]) {
  return { items, pageNumber: 1, pageSize: 7, totalCount: items.length, totalPages: 1, hasNext: false, hasPrevious: false };
}

describe('WeeklyProgressCardComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  async function setup(
    today: Partial<AttendanceTodayResponse> | null,
    history: Observable<unknown> = of(paged([])),
    summary: Observable<unknown> = of({ workingDays: 5 })
  ): Promise<{ fixture: ComponentFixture<WeeklyProgressCardComponent>; api: { getMyHistory: ReturnType<typeof vi.fn>; getMyMonthlySummary: ReturnType<typeof vi.fn> } }> {
    const api = { getMyHistory: vi.fn(() => history), getMyMonthlySummary: vi.fn(() => summary) };
    await TestBed.configureTestingModule({
      imports: [WeeklyProgressCardComponent],
      providers: [
        { provide: TimeTrackingStore, useValue: { today: signal(today as AttendanceTodayResponse | null), loadToday: vi.fn() } },
        { provide: TimeTrackingApiService, useValue: api }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(WeeklyProgressCardComponent);
    fixture.detectChanges();
    return { fixture, api };
  }

  const text = (fixture: ComponentFixture<WeeklyProgressCardComponent>, id: string): string =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`).textContent.trim();

  it('weekRange covers Monday to Sunday of the local week', () => {
    expect(weekRange(NOW)).toEqual({ from: '2026-10-19', to: '2026-10-25', today: '2026-10-22' });
    expect(weekRange(new Date(2026, 9, 25))).toEqual({ from: '2026-10-19', to: '2026-10-25', today: '2026-10-25' });
  });

  it('asks for this week only', async () => {
    const { api } = await setup({ totalWorkedMinutes: 0, requiredWorkMinutes: 480 });
    expect(api.getMyHistory).toHaveBeenCalledWith('2026-10-19', '2026-10-22', 1, 7);
    expect(api.getMyMonthlySummary).toHaveBeenCalledWith('2026-10-19', '2026-10-25');
  });

  it('adds earlier days to today and shows them against working days x required time', async () => {
    const history = of(paged([row('2026-10-19', 480), row('2026-10-20', 480), row('2026-10-21', 420), row('2026-10-22', 999)]));
    const { fixture } = await setup({ totalWorkedMinutes: 60, requiredWorkMinutes: 480 }, history);
    // 480 + 480 + 420 earlier, today's history row ignored in favour of the live 60 => 24h of 40h.
    expect(text(fixture, 'weekly-progress-hours')).toBe('24h / 40h');
    expect(text(fixture, 'weekly-progress-percent')).toBe('60%');
    expect(fixture.nativeElement.querySelector('[data-testid="weekly-progress-arc"]')).toBeTruthy();
  });

  it('uses 8h per working day when today has no required time', async () => {
    const { fixture } = await setup({ totalWorkedMinutes: 0, requiredWorkMinutes: 0 }, of(paged([])), of({ workingDays: 4 }));
    expect(text(fixture, 'weekly-progress-hours')).toBe('0m / 32h');
    expect(text(fixture, 'weekly-progress-percent')).toBe('0%');
    expect(fixture.nativeElement.querySelector('[data-testid="weekly-progress-arc"]')).toBeNull();
  });

  it('shows a message instead of the ring when the week cannot be loaded', async () => {
    const { fixture } = await setup({ totalWorkedMinutes: 30 }, throwError(() => new Error('boom')));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="weekly-progress-error"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="weekly-progress-ring"]')).toBeNull();
  });
});
