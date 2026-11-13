import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, untracked } from '@angular/core';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { PageToolbarService } from '../../../../shared/state/page-toolbar.service';
import { breakpointForWidth, injectBreakpoint } from '../../grid/breakpoint';
import { DashboardKey } from '../../models/dashboard-layout.model';
import { DashboardStore } from '../../state/dashboard.store';
import { DashboardGridComponent, GridReorderEvent, GridResizeEvent, PinnedSize } from '../../ui/dashboard-grid/dashboard-grid.component';
import { DashboardSkeletonComponent } from '../../ui/dashboard-skeleton/dashboard-skeleton.component';
import { QuickActionsCardComponent } from '../quick-actions-card/quick-actions-card.component';
import { WidgetStoreDrawerComponent } from '../widget-store-drawer/widget-store-drawer.component';

/** localStorage key prefixes written by the pre-server-side customize implementation; cleared once. */
const LEGACY_STORAGE_PREFIXES = ['onexso.dashboard_layout', 'onexso.my_team_widget_order'];

function clearLegacyDashboardStorage(): void {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    if (!storage) return;
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) stale.push(key);
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage unavailable (private mode, blocked): nothing to clean.
  }
}

/**
 * Hosts one customizable dashboard: loads it (at the container's real breakpoint), renders the grid and,
 * in edit mode, the widget store drawer. Registers the navbar "Customize" circle, which
 * opens into the Add / Reset / Save capsule while editing (its X cancels). Provides its own DashboardStore.
 *
 * Content slots for the host page:
 *  - [emptyState]: shown below the grid when no gated widget is allowed for the viewer (and capabilities loaded).
 *  - [retryState]: shown when the capabilities query failed (hidden while editing); the host's "Try again" button
 *    calls reload(), which is a no-op while editing.
 */
@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  providers: [DashboardStore],
  imports: [DashboardGridComponent, WidgetStoreDrawerComponent, ConfirmModalComponent, DashboardSkeletonComponent, QuickActionsCardComponent],
  host: { class: 'block', '[class.dashboard-shell--team]': "dashboardKey() === 'my-team'", '(document:keydown.escape)': 'onEscape($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let boot = store.bootstrap();
    <div class="flex flex-col gap-3" data-testid="dashboard-shell">
      @if (boot) {
        <app-dashboard-grid
          [widgets]="store.visibleWidgets()"
          [columns]="boot.grid.columns"
          [rowHeight]="boot.grid.rowHeight"
          [gap]="boot.grid.gap"
          [editing]="store.editing()"
          [pinnedSize]="quickActionsSize()"
          (reordered)="onReordered($event)"
          (resized)="onResized($event)"
          (removed)="store.remove($event)"
          (pinnedChange)="store.setReserved($event)"
          (focusOutside)="focusAddWidget()"
        >
          <!-- Pinned to the grid's top-right corner on both dashboards: never dragged, resized or removed. -->
          <app-quick-actions-card
            gridPinned
            data-testid="dashboard-pinned-quick-actions"
            [onTeamDashboard]="dashboardKey() === 'my-team'"
            (naturalSize)="quickActionsSize.set($event)"
          />
        </app-dashboard-grid>
        @if (boot.capabilitiesUnavailable) {
          <!-- "Try again" reloads the dashboard, which must not happen under an open draft. -->
          @if (!store.editing()) {
            <ng-content select="[retryState]" />
          }
        } @else if (!boot.hasAllowedGatedWidgets) {
          <ng-content select="[emptyState]" />
        }
      } @else if (store.error()) {
        <div class="rounded-2xl border border-[var(--color-border)]/80 bg-[var(--color-surface)] px-4 py-8 text-center" data-testid="dashboard-error" role="alert">
          <p class="text-sm font-semibold text-[var(--color-text-primary)]">Couldn't load your dashboard</p>
          <p class="mt-1 text-xs text-[var(--color-text-secondary)]">{{ store.error() }}</p>
          <button type="button" class="mt-2 text-sm font-semibold text-[var(--color-accent)] hover:underline" data-testid="dashboard-retry" (click)="reload()">Try again</button>
        </div>
      } @else {
        <!-- Grey widget cards on the dashboard's grid while the layout loads, not a spinner. -->
        <app-dashboard-skeleton />
      }
    </div>

    <app-widget-store-drawer [open]="drawerOpen()" [items]="store.available()" (added)="store.add($event)" (closed)="closeDrawer()" />

    <app-confirm-modal
      [open]="confirmingReset()"
      title="Reset dashboard"
      message="Reset your dashboard to the default layout? Your current layout will be replaced."
      confirmLabel="Reset"
      (confirmed)="confirmReset()"
      (cancelled)="confirmingReset.set(false)"
    />
  `,
  styles: `
    /* My Team widgets sit on a light gray instead of the plain surface; their inner gray (bar tracks, chips,
       skeletons) moves one step darker so it still shows against the card. */
    :host(.dashboard-shell--team) {
      --widget-card-bg: var(--color-dashboard-team-widget-bg);
      /* Flat look: KPI tiles and summary cards inside My Team widgets and their popups lose their outlines too. */
      --kpi-tile-border: transparent;
      --kpi-tile-shadow: none;
      --dashboard-kpi-border: transparent;
    }
    :host(.dashboard-shell--team) ::ng-deep app-widget-card > section {
      --color-surface-secondary: var(--color-dashboard-team-widget-inset);
    }
    /* Widget popups open inside the shell and take the same theme-tinted gray as the widget cards. */
    :host(.dashboard-shell--team) ::ng-deep app-modal [role='dialog'] {
      --color-surface-secondary: var(--color-dashboard-team-widget-inset);
      background: var(--color-dashboard-team-widget-bg);
    }
    /* The popups' sticky headers paint over the body, so they take the same gray. */
    :host(.dashboard-shell--team) ::ng-deep app-modal [role='dialog'] :is(.tp-head, .tad-head, .tad-sticky, .efd-head, .efd-sticky, .mfd-head, .mfd-sticky, .tsd-head, .tsd-sticky, .wbld-head, .wtd-head, .wtd-sticky, .wwp-head) {
      background: var(--color-dashboard-team-widget-bg);
    }
    /* The loading skeleton matches: My Team's gray cards, no outline, darker blocks. */
    :host(.dashboard-shell--team) app-dashboard-skeleton {
      --dsk-card-border: transparent;
      --dsk-block: var(--color-dashboard-team-widget-inset);
    }
    /* Flat gray cards on the page: no outline or shadow (border kept transparent so sizes don't shift). */
    :host(.dashboard-shell--team) ::ng-deep app-widget-card > section,
    :host(.dashboard-shell--team) ::ng-deep .qa-card {
      border-color: transparent;
      box-shadow: none;
    }
    /* ...and the page behind them is white with a touch of the theme colour (only while My Team is on screen). */
    ::ng-deep main.main-content:has(app-dashboard-shell.dashboard-shell--team) {
      background: var(--color-dashboard-team-page-bg);
    }
  `
})
export class DashboardShellComponent {
  readonly dashboardKey = input.required<DashboardKey>();

  protected readonly store = inject(DashboardStore);
  private readonly pageToolbar = inject(PageToolbarService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly breakpoint = injectBreakpoint(this.host);
  private readonly measured = signal(false);
  private drawerOpener: HTMLElement | null = null;
  private readonly document = inject(DOCUMENT);

  protected readonly drawerOpen = signal(false);
  /** The pinned Quick Actions card's natural size; the grid turns it into the cells of its top-right corner. */
  protected readonly quickActionsSize = signal<PinnedSize | null>(null);
  protected readonly confirmingReset = signal(false);

  constructor() {
    clearLegacyDashboardStorage();

    // The first breakpoint value is provisional (the host may not be laid out yet), so load only after the first
    // render, reading the real width then. Later breakpoint changes are forwarded to the store.
    afterNextRender(() => {
      void this.store.setBreakpoint(breakpointForWidth(this.host.nativeElement.clientWidth));
      void this.store.load(this.dashboardKey());
      this.measured.set(true);
    });

    effect(() => {
      const bp = this.breakpoint();
      if (untracked(this.measured)) {
        void this.store.setBreakpoint(bp);
      }
    });

    // "Customize" lives in the top navbar as a small circle; while editing it opens into a capsule with
    // Add / Reset / Save, and the circle (now an X) cancels.
    const busy = () => this.store.saving();
    this.pageToolbar.set({
      label: 'Customize dashboard',
      disabled: () => this.store.bootstrap() === null,
      onClick: () => this.store.startEditing(),
      expanded: () => this.store.editing(),
      title: 'Customize your dashboard',
      hint: 'Drag a widget by its handle, resize from the corner, or use the arrow keys on a focused widget.',
      collapseLabel: 'Cancel customizing',
      collapseDisabled: busy,
      onCollapse: () => this.cancel(),
      items: [
        { id: 'dashboard-add-widget', label: () => 'Add', icon: 'add', disabled: busy, onClick: (e) => this.openDrawer(e) },
        { id: 'dashboard-reset', label: () => 'Reset', icon: 'reset', disabled: busy, onClick: () => this.confirmingReset.set(true) },
        { id: 'dashboard-save', label: () => (busy() ? 'Saving…' : 'Save'), icon: 'save', primary: true, disabled: busy, onClick: () => void this.store.save() }
      ]
    });

    inject(DestroyRef).onDestroy(() => {
      this.store.dispose();
      this.pageToolbar.clear();
    });
  }

  /** Loads the dashboard again (hosts call this from their "Try again" button). */
  reload(): void {
    if (this.store.editing()) return;
    void this.store.load(this.dashboardKey());
  }

  protected onReordered(e: GridReorderEvent): void {
    this.store.reorder(e.id, e.index);
  }

  protected onResized(e: GridResizeEvent): void {
    this.store.resize(e.id, e.w, e.h);
  }

  /** The grid removed its last focusable widget from the keyboard: keep focus in the edit UI. */
  protected focusAddWidget(): void {
    // The Add button sits in the navbar capsule, outside this component's view.
    this.document.querySelector<HTMLButtonElement>('[data-testid="dashboard-add-widget"]')?.focus();
  }

  protected cancel(): void {
    this.closeDrawer();
    void this.store.cancel();
  }

  protected openDrawer(event?: Event): void {
    this.drawerOpener = (event?.currentTarget as HTMLElement | null) ?? null;
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    const opener = this.drawerOpener;
    this.drawerOpener = null;
    if (opener?.isConnected) opener.focus();
  }

  protected confirmReset(): void {
    this.confirmingReset.set(false);
    this.closeDrawer();
    void this.store.resetToDefault();
  }

  /** Escape closes the confirm dialog, then the drawer, then cancels editing. Dialogs handle their own Escape when focused. */
  protected onEscape(event: Event): void {
    const target = event.target;
    if (target instanceof Element && target.closest('[role="dialog"]')) return;
    if (this.store.saving()) return;
    if (this.confirmingReset()) {
      this.confirmingReset.set(false);
    } else if (this.drawerOpen()) {
      this.closeDrawer();
    } else if (this.store.editing()) {
      this.cancel();
    }
  }
}
