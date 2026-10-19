import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { QuickActionsCardComponent } from './quick-actions-card.component';

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

describe('QuickActionsCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(today: AttendanceTodayResponse | null, onTeamDashboard = false): Promise<{
    fixture: ComponentFixture<QuickActionsCardComponent>;
    loadToday: ReturnType<typeof vi.fn>;
    startBreak: ReturnType<typeof vi.fn>;
    endBreak: ReturnType<typeof vi.fn>;
  }> {
    const loadToday = vi.fn();
    const startBreak = vi.fn();
    const endBreak = vi.fn();
    const storeStub = {
      today: signal(today),
      actionLoading: signal(false),
      activeAction: signal(null),
      loadToday,
      startBreak,
      endBreak
    };

    await TestBed.configureTestingModule({
      imports: [QuickActionsCardComponent],
      providers: [provideRouter([]), { provide: TimeTrackingStore, useValue: storeStub }]
    }).compileComponents();

    const fixture = TestBed.createComponent(QuickActionsCardComponent);
    fixture.componentRef.setInput('onTeamDashboard', onTeamDashboard);
    fixture.detectChanges();
    return { fixture, loadToday, startBreak, endBreak };
  }

  it('loads today on init', async () => {
    const { loadToday } = await setup(null);
    expect(loadToday).toHaveBeenCalledOnce();
  });

  it('shows "Start Break" and starts a break when canStartBreak is true', async () => {
    const { fixture, startBreak } = await setup(makeToday({ canStartBreak: true, canEndBreak: false }));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="quick-action-break"]');
    expect(button.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-break-label"]').textContent.trim()).toBe('Start Break');

    button.click();
    expect(startBreak).toHaveBeenCalledOnce();
  });

  it('shows "End Break" and ends a break when canEndBreak is true', async () => {
    const { fixture, endBreak } = await setup(makeToday({ canStartBreak: false, canEndBreak: true }));

    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-break-label"]').textContent.trim()).toBe('End Break');
    fixture.nativeElement.querySelector('[data-testid="quick-action-break"]').click();
    expect(endBreak).toHaveBeenCalledOnce();
  });

  it('disables the break button when neither action is available', async () => {
    const { fixture } = await setup(makeToday({ canStartBreak: false, canEndBreak: false }));
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="quick-action-break"]');
    expect(button.disabled).toBe(true);
  });

  it('links My Team and Activity Timeline to their dashboard routes', async () => {
    const { fixture } = await setup(makeToday());
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-team"]').getAttribute('href')).toBe('/dashboard/my-team');
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-work"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-activity-timeline"]').getAttribute('href')).toBe(
      '/dashboard/activity-timeline'
    );
  });

  it('links back to My Work on the My Team dashboard, keeping Start Break and Activity Timeline', async () => {
    const { fixture } = await setup(makeToday(), true);
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-work"]').getAttribute('href')).toBe('/dashboard');
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-team"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-break"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-activity-timeline"]').getAttribute('href')).toBe(
      '/dashboard/activity-timeline'
    );
  });
});
