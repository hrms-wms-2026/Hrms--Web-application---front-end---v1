import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { AttendanceRequestsSummaryCardComponent } from './attendance-requests-summary-card.component';

describe('AttendanceRequestsSummaryCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(): Promise<{
    fixture: ComponentFixture<AttendanceRequestsSummaryCardComponent>;
    myCorrections: ReturnType<typeof signal<{ status: string }[]>>;
    myWorkAreaRequests: ReturnType<typeof signal<{ status: string }[]>>;
  }> {
    const myCorrections = signal<{ status: string }[]>([]);
    const myWorkAreaRequests = signal<{ status: string }[]>([]);

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
});
