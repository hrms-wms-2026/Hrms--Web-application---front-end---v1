import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../core/services/notification.service';
import { DashboardLayoutApiService } from '../../data-access/dashboard-layout-api.service';
import { DashboardBootstrap } from '../../models/dashboard-layout.model';
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
  TestBed.configureTestingModule({
    providers: [
      { provide: DashboardLayoutApiService, useValue: api },
      { provide: NotificationService, useValue: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }
    ]
  });
  const fixture = TestBed.createComponent(MyTeamPageComponent);
  return { fixture, api, el: fixture.nativeElement as HTMLElement };
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
    q(ctx.el, 'my-team-retry')!.click();
    await ready(ctx.fixture);
    expect(ctx.api.listMine.mock.calls.length).toBe(before + 1);
  });
});
