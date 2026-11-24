import { Component, output, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageToolbarService } from '../../../../shared/state/page-toolbar.service';
import { PageToolbarComponent } from '../../../../shared/ui/page-toolbar/page-toolbar.component';
import { DashboardLayoutApiService } from '../../data-access/dashboard-layout-api.service';
import { AvailableWidget, BootstrapWidget, DashboardBootstrap } from '../../models/dashboard-layout.model';
import { DashboardStore } from '../../state/dashboard.store';
import { DashboardShellComponent } from './dashboard-shell.component';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { DashboardKey } from '../../models/dashboard-layout.model';
import { NoEmployeeProfilePanelComponent } from '../no-employee-profile-panel/no-employee-profile-panel.component';

@Component({ selector: 'app-no-employee-profile-panel', standalone: true, template: '<p data-testid="no-employee-profile-panel">panel</p>' })
class PanelStubComponent {
  readonly profileCreated = output<void>();
}

function widget(id: string, key: string, layout = { x: 0, y: 0, w: 4, h: 2 }): BootstrapWidget {
  return {
    instanceId: id,
    widgetKey: key,
    title: 'Title ' + key,
    layout,
    size: { minW: 2, minH: 1, maxW: 12, maxH: 6 },
    dataState: { status: 'success', fetchedAt: null, error: null },
    data: null
  };
}

function boot(over: Partial<DashboardBootstrap> = {}): DashboardBootstrap {
  return {
    id: 'd1',
    key: 'my-work',
    title: 'My Work',
    layoutVersion: 3,
    grid: { breakpoint: 'desktop', columns: 12, rowHeight: 96, gap: 12 },
    widgets: [widget('w1', 'alpha')],
    hasAllowedGatedWidgets: true,
    capabilitiesUnavailable: false,
    ...over
  };
}

function avail(key: string, over: Partial<AvailableWidget> = {}): AvailableWidget {
  return {
    key,
    title: 'Avail ' + key,
    description: 'Describes ' + key,
    size: { minW: 2, minH: 1, maxW: 12, maxH: 6 },
    defaultW: 4,
    defaultH: 2,
    placed: false,
    ...over
  };
}

@Component({
  standalone: true,
  imports: [DashboardShellComponent, PageToolbarComponent],
  template: `
    <app-page-toolbar />
    <app-dashboard-shell [dashboardKey]="key()">
      <p emptyState data-testid="slot-empty">empty slot</p>
      <p retryState data-testid="slot-retry">retry slot</p>
    </app-dashboard-shell>
  `
})
class HostComponent {
  readonly key = signal<DashboardKey>('my-team');
  readonly shell = viewChild.required(DashboardShellComponent);
}

function setup(
  opts: {
    bootstrap?: DashboardBootstrap;
    available?: AvailableWidget[];
    widthSequence?: number[];
    key?: DashboardKey;
    employeeId?: string | null;
  } = {}
) {
  const auth = { authenticated: signal(true), employeeId: signal<string | null>(opts.employeeId === undefined ? 'emp-1' : opts.employeeId) };
  const api = {
    listMine: vi.fn(() => of([{ id: 'd1', key: opts.key ?? 'my-team', title: 'x', layoutVersion: 3 }])),
    bootstrap: vi.fn(() => of(opts.bootstrap ?? boot())),
    available: vi.fn(() => of(opts.available ?? [avail('beta'), avail('gamma')])),
    widgetData: vi.fn(() => of()),
    addWidget: vi.fn(),
    removeWidget: vi.fn(),
    saveLayout: vi.fn(() => of({ layoutVersion: 4 })),
    reset: vi.fn(() => of({ layoutVersion: 4 }))
  };
  // First clientWidth read (the provisional one in the constructor) is mobile; later reads are the real, desktop width.
  const widths = [...(opts.widthSequence ?? [0])];
  let reads = 0;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => (reads++ < widths.length ? widths[reads - 1] : 1300)
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TimeTrackingStore, useValue: { today: signal(null), actionLoading: signal(false), activeAction: signal(null), loadToday: vi.fn(), startBreak: vi.fn(), endBreak: vi.fn() } },
      { provide: PermissionService, useValue: { hasAnyModule: () => true, hasAnyPermission: () => true } },
      { provide: DashboardLayoutApiService, useValue: api },
      { provide: AuthStore, useValue: auth },
      { provide: NotificationService, useValue: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }
    ]
  });
  TestBed.overrideComponent(DashboardShellComponent, {
    remove: { imports: [NoEmployeeProfilePanelComponent] },
    add: { imports: [PanelStubComponent] }
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.key.set(opts.key ?? 'my-team');
  const toolbar = TestBed.inject(PageToolbarService);
  return { fixture, api, toolbar, el: fixture.nativeElement as HTMLElement };
}

async function ready(fixture: ReturnType<typeof setup>['fixture']) {
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
  }
  fixture.detectChanges();
}

function q(el: HTMLElement, testId: string): HTMLElement | null {
  return el.querySelector(`[data-testid="${testId}"]`);
}

function click(el: HTMLElement, testId: string) {
  (q(el, testId) as HTMLElement).click();
}

async function enterEdit(ctx: ReturnType<typeof setup>) {
  ctx.toolbar.action()!.onClick();
  ctx.fixture.detectChanges();
  await ctx.fixture.whenStable();
  ctx.fixture.detectChanges();
}

describe('DashboardShellComponent', () => {
  afterEach(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientWidth'];
  });

  it('loads_once_after_first_real_measurement_not_the_provisional_one', async () => {
    const ctx = setup();
    expect(ctx.api.listMine).not.toHaveBeenCalled();
    await ready(ctx.fixture);
    expect(ctx.api.listMine).toHaveBeenCalledTimes(1);
    expect(ctx.api.bootstrap).toHaveBeenCalledTimes(1);
    expect(ctx.api.bootstrap).toHaveBeenCalledWith('d1', 'desktop');
  });

  it('clears_legacy_localStorage_customization_keys_once_on_construction', async () => {
    localStorage.setItem('onexso.dashboard_layout', '{}');
    localStorage.setItem('onexso.dashboard_layout:emp-1', '{}');
    localStorage.setItem('onexso.my_team_widget_order:emp-1', '[]');
    localStorage.setItem('unrelated.key', 'keep');
    try {
      const ctx = setup();
      await ready(ctx.fixture);
      expect(localStorage.getItem('onexso.dashboard_layout')).toBeNull();
      expect(localStorage.getItem('onexso.dashboard_layout:emp-1')).toBeNull();
      expect(localStorage.getItem('onexso.my_team_widget_order:emp-1')).toBeNull();
      expect(localStorage.getItem('unrelated.key')).toBe('keep');
    } finally {
      localStorage.removeItem('unrelated.key');
    }
  });

  it('survives_unavailable_localStorage', async () => {
    const spy = vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      localStorage.setItem('onexso.dashboard_layout', '{}');
      const ctx = setup();
      await ready(ctx.fixture);
      expect(ctx.api.listMine).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      localStorage.removeItem('onexso.dashboard_layout');
    }
  });

  it('pins_quick_actions_to_the_grid_corner_and_packs_widgets_around_it', async () => {
    const pinned = widget('qa', 'team-quick-actions', { x: 8, y: 0, w: 4, h: 4 });
    const ctx = setup({
      bootstrap: boot({ widgets: [widget('w1', 'alpha', { x: 0, y: 0, w: 8, h: 2 }), pinned, widget('w2', 'beta', { x: 0, y: 2, w: 4, h: 2 })] }),
      available: [avail('team-quick-actions'), avail('gamma')]
    });
    await ready(ctx.fixture);
    // The card sits in the grid's pinned top-right corner (3 x 1 until it has measured itself).
    const corner = q(ctx.el, 'grid-pinned')!;
    expect(corner.style.gridColumn).toBe('10 / span 3');
    expect(corner.style.gridRow).toBe('1 / span 1');
    const card = corner.querySelector('[data-testid="dashboard-pinned-quick-actions"]')!;
    // On the My Team dashboard the card links back to My Work.
    expect(card.querySelector('[data-testid="quick-action-my-work"]')).not.toBeNull();
    const cells = Array.from(ctx.el.querySelectorAll<HTMLElement>('[data-instance-id]'));
    expect(cells.map(c => c.dataset['instanceId'])).toEqual(['w1', 'w2']);
    // beta moves up beside alpha, just under the pinned corner: never under it, and no hole where the old cell was.
    expect(cells[1].style.gridColumn).toBe('9 / span 4');
    expect(cells[1].style.gridRow).toBe('2 / span 2');
    const store = ctx.fixture.debugElement.query(By.directive(DashboardShellComponent)).injector.get(DashboardStore);
    expect(store.available().map(a => a.key)).toEqual(['gamma']);
  });

  it('customize_button_enters_edit_mode', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    expect(ctx.toolbar.action()?.label).toBe('Customize dashboard');
    expect(ctx.toolbar.action()?.disabled()).toBe(false);
    expect(ctx.toolbar.action()?.expanded?.()).toBe(false);
    expect(q(ctx.el, 'dashboard-edit-toolbar')).toBeNull();
    expect(q(ctx.el, 'page-toolbar-close')).toBeNull();

    click(ctx.el, 'page-toolbar-open');
    ctx.fixture.detectChanges();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    expect(q(ctx.el, 'page-toolbar-title')?.textContent).toContain('Customize your dashboard');
    expect(q(ctx.el, 'dashboard-edit-toolbar')).toBeNull();
    expect(ctx.toolbar.action()?.expanded?.()).toBe(true);
    expect(q(ctx.el, 'page-toolbar-open')).toBeNull();
    for (const id of ['dashboard-add-widget', 'dashboard-reset', 'page-toolbar-close', 'dashboard-save']) {
      expect(q(ctx.el, id)).not.toBeNull();
    }
    expect(q(ctx.el, 'dashboard-add-widget')?.textContent).toContain('Add');
  });

  it('capsule_x_cancels_editing', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    click(ctx.el, 'page-toolbar-close');
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'page-toolbar-close')).toBeNull();
    expect(q(ctx.el, 'page-toolbar-open')).not.toBeNull();
  });

  it('clears_the_navbar_button_on_destroy', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    expect(ctx.toolbar.action()).not.toBeNull();
    ctx.fixture.destroy();
    expect(ctx.toolbar.action()).toBeNull();
  });

  it('drawer_lists_only_available', async () => {
    const ctx = setup({ available: [avail('alpha', { placed: true }), avail('beta'), avail('gamma', { defaultW: 6, defaultH: 3 })] });
    await ready(ctx.fixture);
    await enterEdit(ctx);
    click(ctx.el, 'dashboard-add-widget');
    ctx.fixture.detectChanges();

    const drawer = q(ctx.el, 'widget-store-drawer')!;
    expect(drawer.getAttribute('role')).toBe('dialog');
    expect(drawer.getAttribute('aria-label')).toBeTruthy();
    expect(q(ctx.el, 'widget-store-item-alpha')).toBeNull();
    expect(q(ctx.el, 'widget-store-item-beta')?.textContent).toContain('Avail beta');
    expect(q(ctx.el, 'widget-store-item-beta')?.textContent).toContain('Describes beta');
    expect(q(ctx.el, 'widget-store-item-beta')?.textContent).toContain('4 × 2');
    expect(q(ctx.el, 'widget-store-item-gamma')?.textContent).toContain('6 × 3');
  });

  it('add_from_drawer_places_in_draft', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    click(ctx.el, 'dashboard-add-widget');
    ctx.fixture.detectChanges();

    click(ctx.el, 'widget-store-add-beta');
    ctx.fixture.detectChanges();

    expect(ctx.el.querySelector('[data-instance-id="new:beta"]')).not.toBeNull();
    expect(q(ctx.el, 'widget-store-item-beta')).toBeNull();
    expect(q(ctx.el, 'widget-store-item-gamma')).not.toBeNull();
    expect(q(ctx.el, 'widget-store-drawer')).not.toBeNull();
    expect(ctx.api.saveLayout).not.toHaveBeenCalled();
  });

  it('drawer_shows_empty_state_when_nothing_is_available', async () => {
    const ctx = setup({ available: [] });
    await ready(ctx.fixture);
    await enterEdit(ctx);
    click(ctx.el, 'dashboard-add-widget');
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'widget-store-empty')?.textContent).toContain('All widgets are on your dashboard');
  });

  it('reset_requires_confirmation', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);

    click(ctx.el, 'dashboard-reset');
    ctx.fixture.detectChanges();
    expect(ctx.api.reset).not.toHaveBeenCalled();
    expect(ctx.el.querySelector('app-confirm-modal [role="dialog"]')).not.toBeNull();

    // Cancelling the confirm does nothing and keeps editing.
    (ctx.el.querySelector('app-confirm-modal app-button button') as HTMLElement).click();
    ctx.fixture.detectChanges();
    expect(ctx.api.reset).not.toHaveBeenCalled();
    expect(q(ctx.el, 'page-toolbar-close')).not.toBeNull();

    click(ctx.el, 'dashboard-reset');
    ctx.fixture.detectChanges();
    const buttons = ctx.el.querySelectorAll('app-confirm-modal app-button button');
    (buttons[buttons.length - 1] as HTMLElement).click();
    await ctx.fixture.whenStable();
    expect(ctx.api.reset).toHaveBeenCalledWith('d1', 3);
  });

  it('escape_cancels', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'page-toolbar-close')).toBeNull();
    expect(ctx.toolbar.action()?.expanded?.()).toBe(false);
  });

  it('escape_during_a_drag_cancels_only_the_drag_and_keeps_the_draft', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    const store = ctx.fixture.debugElement.query(By.directive(DashboardShellComponent)).injector.get(DashboardStore);
    const handle = ctx.el.querySelector('[data-instance-id="w1"] [data-drag-handle]') as HTMLElement;
    handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 303, clientY: 0, bubbles: true, cancelable: true }));
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'grid-ghost')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ctx.fixture.detectChanges();

    expect(q(ctx.el, 'grid-ghost')).toBeNull();
    expect(store.editing()).toBe(true);
    expect(q(ctx.el, 'page-toolbar-close')).not.toBeNull();
    expect(store.draft().map(w => w.instanceId)).toEqual(['w1']);

    // Once the drag is over, Escape cancels editing as before.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ctx.fixture.detectChanges();
    expect(store.editing()).toBe(false);
  });

  it('escape_closes_the_drawer_first_then_cancels', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    click(ctx.el, 'dashboard-add-widget');
    ctx.fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'widget-store-drawer')).toBeNull();
    expect(q(ctx.el, 'page-toolbar-close')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'page-toolbar-close')).toBeNull();
  });

  it('save_is_disabled_while_saving', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    const saveBtn = () => q(ctx.el, 'dashboard-save') as HTMLButtonElement;
    expect(saveBtn().disabled).toBe(false);
    const store = ctx.fixture.debugElement.query(By.directive(DashboardShellComponent)).injector.get(DashboardStore);
    store.saving.set(true);
    ctx.fixture.detectChanges();
    expect(saveBtn().disabled).toBe(true);
    for (const id of ['dashboard-add-widget', 'dashboard-reset', 'page-toolbar-close']) {
      expect((q(ctx.el, id) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('escape_does_nothing_while_saving', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    const store = ctx.fixture.debugElement.query(By.directive(DashboardShellComponent)).injector.get(DashboardStore);
    store.saving.set(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ctx.fixture.detectChanges();
    expect(store.editing()).toBe(true);
  });

  it('removing_the_last_widget_from_the_keyboard_focuses_add_widget', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    const cell = ctx.el.querySelector('[data-instance-id="w1"]') as HTMLElement;
    cell.focus();
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    ctx.fixture.detectChanges();
    expect(ctx.el.querySelector('[data-instance-id="w1"]')).toBeNull();
    expect(document.activeElement).toBe(q(ctx.el, 'dashboard-add-widget'));
  });

  it('forwards_later_breakpoint_changes_to_the_store', async () => {
    // The shell's breakpoint observer is the first one created (the grid and Quick Actions card add their own).
    let resizeCb: ResizeObserverCallback | null = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCb ??= cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }
    );
    try {
      const ctx = setup();
      await ready(ctx.fixture);
      expect(ctx.api.bootstrap).toHaveBeenCalledTimes(1);
      resizeCb!([{ contentRect: { width: 900 } } as ResizeObserverEntry], {} as ResizeObserver);
      await ready(ctx.fixture);
      expect(ctx.api.bootstrap).toHaveBeenLastCalledWith('d1', 'tablet');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('destroy_exits_editing_without_re_bootstrapping', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    await enterEdit(ctx);
    ctx.api.bootstrap.mockClear();
    ctx.fixture.destroy();
    await new Promise(resolve => setTimeout(resolve));
    expect(ctx.api.bootstrap).not.toHaveBeenCalled();
  });

  it('after_add_focus_moves_to_next_item_then_close_and_announces', async () => {
    const ctx = setup({ available: [avail('beta'), avail('gamma')] });
    await ready(ctx.fixture);
    await enterEdit(ctx);
    click(ctx.el, 'dashboard-add-widget');
    ctx.fixture.detectChanges();
    click(ctx.el, 'widget-store-add-beta');
    await ready(ctx.fixture);
    expect(q(ctx.el, 'widget-store-live')?.textContent).toContain('Added Avail beta');
    expect(document.activeElement).toBe(q(ctx.el, 'widget-store-add-gamma'));
    click(ctx.el, 'widget-store-add-gamma');
    await ready(ctx.fixture);
    expect(q(ctx.el, 'widget-store-live')?.textContent).toContain('Added Avail gamma');
    expect(document.activeElement).toBe(q(ctx.el, 'widget-store-close'));
  });

  it('renders_empty_state_slot_when_no_allowed_gated_widgets', async () => {
    const ctx = setup({ bootstrap: boot({ hasAllowedGatedWidgets: false, widgets: [] }) });
    await ready(ctx.fixture);
    expect(q(ctx.el, 'slot-empty')).not.toBeNull();
    expect(q(ctx.el, 'slot-retry')).toBeNull();
  });

  it('renders_retry_slot_only_when_capabilities_unavailable', async () => {
    const ctx = setup({ bootstrap: boot({ hasAllowedGatedWidgets: false, capabilitiesUnavailable: true, widgets: [] }) });
    await ready(ctx.fixture);
    expect(q(ctx.el, 'slot-retry')).not.toBeNull();
    expect(q(ctx.el, 'slot-empty')).toBeNull();
  });

  it('hides_the_retry_slot_and_ignores_reload_while_editing', async () => {
    const ctx = setup({ bootstrap: boot({ hasAllowedGatedWidgets: false, capabilitiesUnavailable: true }) });
    await ready(ctx.fixture);
    expect(q(ctx.el, 'slot-retry')).not.toBeNull();
    await enterEdit(ctx);
    expect(q(ctx.el, 'slot-retry')).toBeNull();
    ctx.api.listMine.mockClear();
    ctx.fixture.componentInstance.shell().reload();
    expect(ctx.api.listMine).not.toHaveBeenCalled();
  });

  it('renders_neither_slot_when_gated_widgets_are_allowed', async () => {
    const ctx = setup();
    await ready(ctx.fixture);
    expect(q(ctx.el, 'slot-empty')).toBeNull();
    expect(q(ctx.el, 'slot-retry')).toBeNull();
  });

  it('shows_the_skeleton_while_the_dashboard_is_loading', async () => {
    const ctx = setup();
    ctx.api.listMine.mockReturnValue(new (await import('rxjs')).Observable(() => undefined) as never);
    ctx.fixture.detectChanges();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();
    expect(ctx.el.querySelector('app-dashboard-skeleton')).not.toBeNull();
    expect(ctx.el.querySelector('app-loader')).toBeNull();
    expect(ctx.el.querySelector('app-dashboard-grid')).toBeNull();
  });

  it('shows_error_state_and_reload_calls_load_again', async () => {
    const { throwError } = await import('rxjs');
    const ctx = setup();
    ctx.api.listMine.mockReturnValueOnce(throwError(() => new Error('boom')));
    await ready(ctx.fixture);
    expect(q(ctx.el, 'dashboard-error')).not.toBeNull();
    click(ctx.el, 'dashboard-retry');
    await ready(ctx.fixture);
    expect(ctx.api.listMine).toHaveBeenCalledTimes(2);
    expect(q(ctx.el, 'dashboard-error')).toBeNull();
    // the public method is what hosts call
    ctx.fixture.componentInstance.shell().reload();
    expect(ctx.api.listMine).toHaveBeenCalledTimes(3);
  });

  describe('account without an employee profile', () => {
    it('shows the no-profile panel on My Work instead of the grid and loads nothing', async () => {
      const ctx = setup({ key: 'my-work', employeeId: null, bootstrap: boot() });
      await ready(ctx.fixture);

      expect(q(ctx.el, 'no-employee-profile-panel')).not.toBeNull();
      expect(ctx.el.querySelector('app-dashboard-grid')).toBeNull();
      expect(ctx.api.listMine).not.toHaveBeenCalled();
    });

    it('keeps the normal grid on My Team even without a profile', async () => {
      const ctx = setup({ key: 'my-team', employeeId: null });
      await ready(ctx.fixture);

      expect(q(ctx.el, 'no-employee-profile-panel')).toBeNull();
      expect(ctx.api.listMine).toHaveBeenCalled();
    });

    it('keeps the normal grid on My Work for an employee', async () => {
      const ctx = setup({ key: 'my-work', employeeId: 'emp-1', bootstrap: boot() });
      await ready(ctx.fixture);

      expect(q(ctx.el, 'no-employee-profile-panel')).toBeNull();
      expect(ctx.el.querySelector('app-dashboard-grid')).not.toBeNull();
    });

    it('loads My Work once the profile is created', async () => {
      const ctx = setup({ key: 'my-work', employeeId: null, bootstrap: boot() });
      await ready(ctx.fixture);
      const panel = ctx.fixture.debugElement.query((d) => d.componentInstance instanceof PanelStubComponent)
        .componentInstance as PanelStubComponent;

      panel.profileCreated.emit();
      await ready(ctx.fixture);

      expect(ctx.api.listMine).toHaveBeenCalledTimes(1);
    });
  });
});
