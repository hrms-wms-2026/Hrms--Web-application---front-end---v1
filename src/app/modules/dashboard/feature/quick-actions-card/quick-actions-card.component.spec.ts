import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component, output, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { NewLeaveRequestHostComponent } from '../../../leave/ui/new-leave-request-host/new-leave-request-host.component';
import { QuickActionsCardComponent } from './quick-actions-card.component';

/** Stands in for the leave request popup, which would load the real leave stores over HTTP. */
@Component({ selector: 'app-new-leave-request-host', standalone: true, template: '' })
class LeaveRequestHostStub {
  readonly closed = output<void>();
}

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

  async function setup(today: AttendanceTodayResponse | null, onTeamDashboard = false, canAccess = true): Promise<{
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
      activeAction: signal<string | null>(null),
      loadToday,
      startBreak,
      endBreak
    };

    await TestBed.configureTestingModule({
      imports: [QuickActionsCardComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: storeStub },
        { provide: PermissionService, useValue: { hasAnyModule: () => canAccess, hasAnyPermission: () => canAccess } }
      ]
    })
      .overrideComponent(QuickActionsCardComponent, {
        remove: { imports: [NewLeaveRequestHostComponent] },
        add: { imports: [LeaveRequestHostStub] }
      })
      .compileComponents();

    const fixture = TestBed.createComponent(QuickActionsCardComponent);
    fixture.componentRef.setInput('onTeamDashboard', onTeamDashboard);
    fixture.detectChanges();
    return { fixture, loadToday, startBreak, endBreak };
  }

  it('builds one tile per action, in order, on My Team', async () => {
    const { fixture } = await setup(makeToday(), true);
    const ids = Array.from(fixture.nativeElement.querySelectorAll('.qa-btn')).map((el) => (el as HTMLElement).dataset['testid']);
    expect(ids).toEqual(['quick-action-break', 'quick-action-my-work', 'quick-action-time-off']);
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-time-off"]').getAttribute('data-tone')).toBe('slate');
  });

  it('shows a busy, disabled break tile while a break action runs', async () => {
    const { fixture } = await setup(makeToday());
    const store = TestBed.inject(TimeTrackingStore) as unknown as { actionLoading: ReturnType<typeof signal<boolean>>; activeAction: ReturnType<typeof signal<string | null>> };
    store.actionLoading.set(true);
    store.activeAction.set('startBreak');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="quick-action-break"]');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.qa-spinner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-break-label"]').textContent.trim()).toBe('Working…');
  });

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

  it('links My Team to the team dashboard', async () => {
    const { fixture } = await setup(makeToday());
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-team"]').getAttribute('href')).toBe('/dashboard/my-team');
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-work"]')).toBeNull();
  });

  it('links back to My Work on the My Team dashboard, keeping Start Break', async () => {
    const { fixture } = await setup(makeToday(), true);
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-work"]').getAttribute('href')).toBe('/dashboard');
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-my-team"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-break"]')).toBeTruthy();
  });

  it('shows Start Break, My Team and Request Time Off on My Work', async () => {
    const { fixture } = await setup(makeToday());
    const ids = Array.from(fixture.nativeElement.querySelectorAll('[data-testid^="quick-action-"]'))
      .map((el) => (el as HTMLElement).dataset['testid'])
      .filter((id) => !id?.endsWith('-label'));
    expect(ids).toEqual(['quick-action-break', 'quick-action-my-team', 'quick-action-time-off']);
  });

  it('opens the leave request popup from Request Time Off, and hides the tile from a viewer who cannot open Time Off', async () => {
    const allowed = await setup(makeToday());
    const el: HTMLElement = allowed.fixture.nativeElement;
    expect(el.querySelector('[data-testid="quick-action-time-off-label"]')?.textContent?.trim()).toBe('Time Off');
    expect(el.querySelector('app-new-leave-request-host')).toBeNull();
    (el.querySelector('[data-testid="quick-action-time-off"]') as HTMLButtonElement).click();
    allowed.fixture.detectChanges();
    expect(el.querySelector('app-new-leave-request-host')).not.toBeNull();
    TestBed.resetTestingModule();
    const { fixture } = await setup(makeToday(), true, false);
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-time-off"]')).toBeNull();
  });
});
