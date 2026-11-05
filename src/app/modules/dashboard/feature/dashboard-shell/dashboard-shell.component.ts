import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { PageToolbarService } from '../../../../shared/state/page-toolbar.service';
import { breakpointForWidth, injectBreakpoint } from '../../grid/breakpoint';
import { DashboardKey } from '../../models/dashboard-layout.model';
import { DashboardStore } from '../../state/dashboard.store';
import { DashboardGridComponent, GridReorderEvent, GridResizeEvent, PinnedSize } from '../../ui/dashboard-grid/dashboard-grid.component';
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
 * in edit mode, the toolbar (Add widget / Reset / Cancel / Save) and the widget store drawer. Registers the
 * navbar "Customize" button. Provides its own DashboardStore.
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
  imports: [DashboardGridComponent, WidgetStoreDrawerComponent, ConfirmModalComponent, LoaderComponent, QuickActionsCardComponent],
  host: { class: 'block', '(document:keydown.escape)': 'onEscape($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let boot = store.bootstrap();
    <div class="flex flex-col gap-3" data-testid="dashboard-shell">
      @if (store.editing()) {
        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)]/60 px-4 py-3"
          data-testid="dashboard-edit-toolbar"
        >
          <div>
            <h2 class="text-sm font-bold text-[var(--color-text-primary)]">Customize your dashboard</h2>
            <p class="text-xs text-[var(--color-text-secondary)]">Drag a widget by its handle, resize from the corner, or use the arrow keys on a focused widget.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button #addWidgetBtn type="button" class="shell-btn" data-testid="dashboard-add-widget" [disabled]="store.saving()" (click)="openDrawer($event)">Add widget</button>
            <button type="button" class="shell-btn" data-testid="dashboard-reset" [disabled]="store.saving()" (click)="confirmingReset.set(true)">Reset</button>
            <button type="button" class="shell-btn" data-testid="dashboard-cancel" [disabled]="store.saving()" (click)="cancel()">Cancel</button>
            <button type="button" class="shell-btn shell-btn--primary" data-testid="dashboard-save" [disabled]="store.saving()" (click)="store.save()">
              {{ store.saving() ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      }

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
        <div class="flex min-h-[200px] items-center justify-center rounded-2xl border border-[var(--color-border)]/80 bg-[var(--color-surface)]">
          <app-loader label="Loading your dashboard" />
        </div>
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
    .shell-btn {
      border-radius: 0.5rem;
      border: 1px solid var(--color-border-strong);
      background: var(--color-surface);
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .shell-btn:hover:not(:disabled) {
      background: var(--color-surface-secondary);
    }
    .shell-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .shell-btn--primary {
      border-color: var(--color-accent);
      background: var(--color-accent);
      color: var(--color-accent-contrast);
    }
    .shell-btn--primary:hover:not(:disabled) {
      background: var(--color-accent-hover);
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
  private readonly addWidgetBtn = viewChild<ElementRef<HTMLButtonElement>>('addWidgetBtn');

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

    // "Customize" lives in the top navbar; the edit toolbar takes over once editing starts.
    effect(() => {
      if (this.store.editing()) {
        this.pageToolbar.clear();
      } else {
        this.pageToolbar.set({
          label: 'Customize',
          disabled: () => this.store.bootstrap() === null,
          onClick: () => this.store.startEditing()
        });
      }
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
    this.addWidgetBtn()?.nativeElement.focus();
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
