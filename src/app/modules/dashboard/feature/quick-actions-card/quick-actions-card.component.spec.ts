import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { of } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { AttendanceTodayResponse } from '../../../attendance/models/time-tracking.model';
import { QuickActionsCardComponent } from './quick-actions-card.component';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';

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
      activeAction: signal(null),
      loadToday,
      startBreak,
      endBreak
    };

    await TestBed.configureTestingModule({
      imports: [QuickActionsCardComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: storeStub },
        { provide: PermissionService, useValue: { hasAnyModule: () => canAccess, hasAnyPermission: () => canAccess } },
        { provide: ProjectApiService, useValue: { listMine: () => of({ items: [], pageNumber: 1, pageSize: 100, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false }) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(QuickActionsCardComponent);
    fixture.componentRef.setInput('onTeamDashboard', onTeamDashboard);
    fixture.detectChanges();
    return { fixture, loadToday, startBreak, endBreak };
  }

  it('a 2x2 card shows icon-only tiles that keep their names for screen readers and as tooltips', async () => {
    stubResizeObserver();
    try {
      const { fixture } = await setup(makeToday(), true);
      const el: HTMLElement = fixture.nativeElement;
      const section = el.querySelector('[data-purpose="quick-actions"]')!;
      expect(section.getAttribute('data-compact')).toBe('false');

      FakeResizeObserver.instances[0].trigger(206, 204);
      fixture.detectChanges();
      expect(section.getAttribute('data-compact')).toBe('true');
      const timeline = el.querySelector('[data-testid="quick-action-activity-timeline"]')!;
      expect(timeline.getAttribute('title')).toBe('Activity Timeline');
      expect(timeline.textContent).toContain('Activity Timeline');
      expect(el.querySelector('[data-testid="quick-action-break"]')!.getAttribute('title')).toBe('Start Break');

      FakeResizeObserver.instances[0].trigger(315, 312);
      fixture.detectChanges();
      expect(section.getAttribute('data-compact')).toBe('false');
      expect(timeline.getAttribute('title')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('shows only Start Break, My Team and Activity Timeline on My Work', async () => {
    const { fixture } = await setup(makeToday());
    const ids = Array.from(fixture.nativeElement.querySelectorAll('[data-testid^="quick-action-"]'))
      .map((el) => (el as HTMLElement).dataset['testid'])
      .filter((id) => id !== 'quick-action-break-label');
    expect(ids).toEqual(['quick-action-break', 'quick-action-my-team', 'quick-action-activity-timeline']);
  });

  it('links Create Ticket to the Inbox and Settings to settings on My Team', async () => {
    const { fixture } = await setup(makeToday(), true);
    const href = (id: string): string | null =>
      fixture.nativeElement.querySelector(`[data-testid="quick-action-${id}"]`)?.getAttribute('href') ?? null;
    expect(href('create-ticket')).toBe('/inbox');
    expect(href('settings')).toBe('/settings');
  });

  it('opens the Create Task popup over the page (attached to body), once, until it closes', async () => {
    const { fixture } = await setup(makeToday(), true);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="quick-action-create-task"]');
    button.click();
    button.click();
    fixture.detectChanges();
    expect(document.querySelectorAll('.cdk-overlay-container app-quick-create-task').length).toBe(1);
    expect(fixture.nativeElement.querySelector('app-quick-create-task')).toBeNull();
    fixture.destroy();
    expect(document.querySelector('.cdk-overlay-container app-quick-create-task')).toBeNull();
  });

  it('hides Create Task and Settings from a viewer who cannot open Work or any settings page', async () => {
    const { fixture } = await setup(makeToday(), true, false);
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-create-ticket"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-create-task"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="quick-action-settings"]')).toBeNull();
  });
});
