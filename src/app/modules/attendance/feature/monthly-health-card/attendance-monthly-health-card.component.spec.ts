import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceMonthlySummaryResponse } from '../../models/time-tracking.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { AttendanceMonthlyHealthCardComponent } from './attendance-monthly-health-card.component';

describe('AttendanceMonthlyHealthCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(): Promise<{
    fixture: ComponentFixture<AttendanceMonthlyHealthCardComponent>;
    monthlySummary: ReturnType<typeof signal<AttendanceMonthlySummaryResponse | null>>;
    loadMonthlySummary: ReturnType<typeof vi.fn>;
  }> {
    const monthlySummary = signal<AttendanceMonthlySummaryResponse | null>(null);
    const loadMonthlySummary = vi.fn(() => Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [AttendanceMonthlyHealthCardComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: { monthlySummary, monthlySummaryLoading: signal(false), monthlySummaryError: signal(null), loadMonthlySummary }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceMonthlyHealthCardComponent);
    return { fixture, monthlySummary, loadMonthlySummary };
  }

  it('requests the current month range on init', async () => {
    const { fixture, loadMonthlySummary } = await setup();
    fixture.detectChanges();
    expect(loadMonthlySummary).toHaveBeenCalledTimes(1);
  });

  it('renders days-present-over-working-days and each health metric', async () => {
    const { fixture, monthlySummary } = await setup();
    monthlySummary.set({ workingDays: 20, daysPresent: 18, lateArrivals: 2, earlyDepartures: 1, missingClockOuts: 0 });
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('18');
    expect(text).toContain('20');
    expect(text).toContain('2');
  });
});
