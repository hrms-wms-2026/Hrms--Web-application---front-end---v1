import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceTodayResponse } from '../../models/time-tracking.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { AttendanceStatusCardComponent } from './attendance-status-card.component';

describe('AttendanceStatusCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(today: Partial<AttendanceTodayResponse> | null): Promise<ComponentFixture<AttendanceStatusCardComponent>> {
    await TestBed.configureTestingModule({
      imports: [AttendanceStatusCardComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: {
            today: signal(today as AttendanceTodayResponse | null),
            todayLoading: signal(false),
            actionLoading: signal(false),
            activeAction: signal(null),
            clockIn: vi.fn(),
            startBreak: vi.fn(),
            endBreak: vi.fn(),
            clockOut: vi.fn()
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceStatusCardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a 0% worked-vs-scheduled bar when nothing has been worked yet', async () => {
    const fixture = await setup({
      totalWorkedMinutes: 0, requiredWorkMinutes: 480, attendanceStatus: 'not_clocked_in',
      allowedClockInMethods: { web: true, desktopTray: false, biometric: false, photoRequired: false, locationRequired: false, allowedRadiusMeters: null }
    });

    const bar: HTMLElement = fixture.nativeElement.querySelector('[data-testid="worked-progress-fill"]');
    expect(bar.style.width).toBe('0%');
  });

  it('caps the worked-vs-scheduled bar at 100% when worked exceeds scheduled', async () => {
    const fixture = await setup({
      totalWorkedMinutes: 600, requiredWorkMinutes: 480, attendanceStatus: 'working',
      allowedClockInMethods: { web: true, desktopTray: false, biometric: false, photoRequired: false, locationRequired: false, allowedRadiusMeters: null }
    });

    const bar: HTMLElement = fixture.nativeElement.querySelector('[data-testid="worked-progress-fill"]');
    expect(bar.style.width).toBe('100%');
  });
});
