import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../core/services/notification.service';
import { DashboardLayoutApiService } from '../../data-access/dashboard-layout-api.service';
import { DashboardBootstrap } from '../../models/dashboard-layout.model';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamPageComponent } from './my-team-page.component';

function boot(over: Partial<DashboardBootstrap> = {}): DashboardBootstrap {
  return {
    id: 'd2',
    key: 'my-team',
    title: 'My Team',
    layoutVersion: 1,
    grid: { breakpoint: 'desktop', columns: 12, rowHeight: 96, gap: 12 },
    widgets: [],
    hasAllowedGatedWidgets: true,
    capabilitiesUnavailable: false,
    ...over
  };
}

function setup(bootstrap: DashboardBootstrap) {
  const api = {
    listMine: vi.fn(() => of([{ id: 'd2', key: 'my-team', title: 'My Team', layoutVersion: 1 }])),
    bootstrap: vi.fn(() => of(bootstrap)),
    available: vi.fn(() => of([])),
    widgetData: vi.fn(() => of())
  };
  const loadCapabilities = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: MyTeamCapabilitiesStore, useValue: { loadCapabilities } },
      { provide: TimeTrackingStore, useValue: { today: signal(null), actionLoading: signal(false), activeAction: signal(null), loadToday: vi.fn(), startBreak: vi.fn(), endBreak: vi.fn() } },
      { provide: PermissionService, useValue: { hasAnyModule: () => true, hasAnyPermission: () => true } },
      { provide: ProjectApiService, useValue: { listMine: () => of({ items: [], pageNumber: 1, pageSize: 100, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false }) } },
      { provide: DashboardLayoutApiService, useValue: api },
      { provide: NotificationService, useValue: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }
    ]
  });
  const fixture = TestBed.createComponent(MyTeamPageComponent);
  return { fixture, api, loadCapabilities, el: fixture.nativeElement as HTMLElement };
}

async function ready(fixture: ReturnType<typeof setup>['fixture']) {
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
  }
  fixture.detectChanges();
}

const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe('MyTeamPageComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads_capabilities_on_init', async () => {
    const ctx = setup(boot());
    await ready(ctx.fixture);
    expect(ctx.loadCapabilities).toHaveBeenCalledTimes(1);
  });

  it('shows_quick_actions_and_the_empty_state_together', async () => {
    const quick = { instanceId: 'q1', widgetKey: 'team-quick-actions', title: 'Quick Actions', layout: { x: 0, y: 0, w: 4, h: 3 }, size: { minW: 2, minH: 2, maxW: 12, maxH: 6 }, dataState: { status: 'client' as const, fetchedAt: null, error: null }, data: null };
    const ctx = setup(boot({ hasAllowedGatedWidgets: false, widgets: [quick] }));
    await ready(ctx.fixture);
    expect(ctx.el.querySelector('app-quick-actions-card')).not.toBeNull();
    expect(q(ctx.el, 'quick-action-my-work')).not.toBeNull();
    expect(q(ctx.el, 'my-team-empty')).not.toBeNull();
  });

  it('hosts_the_my_team_shell', async () => {
    const ctx = setup(boot());
    await ready(ctx.fixture);
    expect(ctx.el.querySelector('app-dashboard-shell')).not.toBeNull();
    expect(q(ctx.el, 'my-team-empty')).toBeNull();
    expect(q(ctx.el, 'my-team-retry')).toBeNull();
  });

  it('shows_empty_state_when_no_team_widgets', async () => {
    const ctx = setup(boot({ hasAllowedGatedWidgets: false }));
    await ready(ctx.fixture);
    expect(q(ctx.el, 'my-team-empty')).not.toBeNull();
    expect(ctx.el.textContent).toContain('No team to show yet');
    expect(q(ctx.el, 'my-team-retry')).toBeNull();
  });

  it('shows_retry_state_when_capabilities_unavailable', async () => {
    const ctx = setup(boot({ hasAllowedGatedWidgets: false, capabilitiesUnavailable: true }));
    await ready(ctx.fixture);
    expect(q(ctx.el, 'my-team-retry')).not.toBeNull();
    expect(ctx.el.textContent).toContain("Couldn't load your team");
    expect(q(ctx.el, 'my-team-empty')).toBeNull();
  });

  it('retry_reloads', async () => {
    const ctx = setup(boot({ hasAllowedGatedWidgets: false, capabilitiesUnavailable: true }));
    await ready(ctx.fixture);
    const before = ctx.api.listMine.mock.calls.length;
    const capsBefore = ctx.loadCapabilities.mock.calls.length;
    q(ctx.el, 'my-team-retry')!.click();
    await ready(ctx.fixture);
    expect(ctx.api.listMine.mock.calls.length).toBe(before + 1);
    expect(ctx.loadCapabilities.mock.calls.length).toBe(capsBefore + 1);
  });
});
