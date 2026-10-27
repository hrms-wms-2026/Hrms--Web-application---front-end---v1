import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { AttendanceRequestsSummaryCardComponent } from './attendance-requests-summary-card.component';

interface CorrectionFixture { status: string; correctionType?: string; workDate?: string }
interface WorkAreaFixture { status: string; date?: string }

describe('AttendanceRequestsSummaryCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(): Promise<{
    fixture: ComponentFixture<AttendanceRequestsSummaryCardComponent>;
    myCorrections: ReturnType<typeof signal<CorrectionFixture[]>>;
    myWorkAreaRequests: ReturnType<typeof signal<WorkAreaFixture[]>>;
  }> {
    const myCorrections = signal<CorrectionFixture[]>([]);
    const myWorkAreaRequests = signal<WorkAreaFixture[]>([]);

    await TestBed.configureTestingModule({
      imports: [AttendanceRequestsSummaryCardComponent],
      providers: [
        provideRouter([]),
        {
          provide: TimeTrackingStore,
          useValue: {
            myCorrections, myCorrectionsLoaded: signal(true), loadMyCorrections: vi.fn(),
            myWorkAreaRequests, myWorkAreaRequestsLoaded: signal(true), loadMyWorkAreaRequests: vi.fn()
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceRequestsSummaryCardComponent);
    return { fixture, myCorrections, myWorkAreaRequests };
  }

  it('shows a no-pending-requests message when nothing is pending', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pending requests');
  });

  it('counts pending corrections and work-area requests together', async () => {
    const { fixture, myCorrections, myWorkAreaRequests } = await setup();
    myCorrections.set([{ status: 'pending' }, { status: 'approved' }]);
    myWorkAreaRequests.set([{ status: 'pending' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2 pending');
  });

  it('lists recent corrections and work-area changes with title, date, and status badge', async () => {
    const { fixture, myCorrections, myWorkAreaRequests } = await setup();
    myCorrections.set([{ status: 'pending', correctionType: 'clock_in', workDate: '2026-09-07' }]);
    myWorkAreaRequests.set([{ status: 'approved', date: '2026-09-05' }]);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.requests-summary-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Clock-in time');
    expect(rows[0].querySelector('.requests-summary-badge')?.textContent?.trim()).toBe('Pending review');
    expect(rows[1].textContent).toContain('Work-area change');
    expect(rows[1].querySelector('.requests-summary-badge')?.textContent?.trim()).toBe('Approved');
  });

  it('caps the recent requests list at three items', async () => {
    const { fixture, myCorrections } = await setup();
    myCorrections.set([
      { status: 'pending', correctionType: 'clock_in', workDate: '2026-09-01' },
      { status: 'pending', correctionType: 'clock_out', workDate: '2026-09-02' },
      { status: 'pending', correctionType: 'break', workDate: '2026-09-03' },
      { status: 'pending', correctionType: 'full_day', workDate: '2026-09-04' }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.requests-summary-row').length).toBe(3);
  });
});
