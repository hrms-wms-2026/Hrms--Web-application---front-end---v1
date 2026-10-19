import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { canAccessNavItem } from '../../../../layouts/main-layout/nav/nav-access';
import { NAV_ITEMS } from '../../../../layouts/main-layout/nav/nav-items.config';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { QuickCreateTaskComponent } from '../quick-create-task/quick-create-task.component';

@Component({
  selector: 'app-quick-actions-card',
  standalone: true,
  imports: [RouterLink],
  // A size container: the layout inside follows the card's own width (Small / Large on the grid).
  host: { class: '@container block' },
  templateUrl: './quick-actions-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionsCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly permissions = inject(PermissionService);
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private createTaskRef: OverlayRef | null = null;

  /** Which dashboard the card sits on: the middle action links to the other one - My Team on the
   * personal dashboard, My Work on the My Team dashboard. */
  readonly onTeamDashboard = input(false);

  protected readonly today = this.store.today;
  protected readonly actionLoading = this.store.actionLoading;
  protected readonly activeAction = this.store.activeAction;

  /** Create Task and Settings show only to viewers who can open those pages, by the same rule as
   * the sidebar (nav-items.config): Work needs a Work module, Settings a reachable settings page. */
  protected readonly canOpenWork = computed(() => this.canOpen('work'));
  protected readonly canOpenSettings = computed(() => this.canOpen('settings'));

  protected readonly onBreak = computed(() => this.today()?.canEndBreak ?? false);
  protected readonly breakDisabled = computed(() => {
    const today = this.today();
    if (!today) return true;
    return !today.canStartBreak && !today.canEndBreak;
  });

  protected readonly breakLabel = computed(() => (this.onBreak() ? 'End Break' : 'Start Break'));
  protected readonly breakBusy = computed(
    () => this.actionLoading() && (this.activeAction() === 'startBreak' || this.activeAction() === 'endBreak')
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.createTaskRef?.dispose());
  }

  ngOnInit(): void {
    void this.store.loadToday();
  }

  /**
   * Opens the Create Task popup (project picker, then the task form). It is attached to <body>
   * through a CDK overlay: this card and the dashboard viewport are CSS size containers, which
   * would otherwise trap the popup's fixed-position backdrop inside the card.
   */
  protected openCreateTask(): void {
    if (this.createTaskRef) return;
    const ref = this.overlay.create();
    const component = ref.attach(new ComponentPortal(QuickCreateTaskComponent, null, this.injector));
    component.setInput('open', true);
    component.instance.closed.subscribe(() => {
      ref.dispose();
      this.createTaskRef = null;
    });
    this.createTaskRef = ref;
  }

  private canOpen(navId: string): boolean {
    const item = NAV_ITEMS.find((nav) => nav.id === navId);
    return !!item && canAccessNavItem(item, this.permissions);
  }

  protected toggleBreak(): void {
    if (this.actionLoading()) return;
    if (this.onBreak()) {
      void this.store.endBreak();
    } else if (this.today()?.canStartBreak) {
      void this.store.startBreak();
    }
  }
}
