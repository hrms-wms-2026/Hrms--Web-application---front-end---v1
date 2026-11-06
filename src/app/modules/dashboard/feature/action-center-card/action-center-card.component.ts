import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import {
  ActionCenterDecisionService,
  ApprovalDecision,
  DECISION_COMMENT_MAX,
  canDecideInline,
  rejectReasonRequired
} from '../../data-access/action-center-decision.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import {
  InboxFilter,
  InboxItem,
  buildActionInbox,
  filterInbox,
  inboxAgeClass,
  inboxBadge,
  inboxCounts,
  isExceptionSource
} from '../../utils/action-inbox.util';
import { actionCenterRailVisible } from '../../utils/my-team-widget-visibility.util';
import { safeServerDetail } from '../../../../core/services/error-handler.service';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

/** How often the "x min ago" ages tick (no API call). */
const CLOCK_TICK_MS = 60_000;
/** Inbox rows on the compact card; "View all" pops out the rest. */
const CARD_ROW_LIMIT = 4;

interface FilterChip {
  key: InboxFilter;
  label: string;
  count: number;
}

interface DecisionForm {
  key: string;
  mode: ApprovalDecision;
}

/**
 * The Action Center as one inbox: every pending approval, open exception and overdue task in a
 * single list, longest-waiting first, each showing the person's photo with a small type icon, with
 * All / Approvals / Alerts / Overdue
 * filters to look at each separately. Approvals can be approved or rejected in place (through the
 * request's own module API, after a confirm); every row's arrow opens its own screen. Reloads the
 * action-items response on the refresh button and when the tab becomes visible again (no timed
 * polling); led-progress is owned by Team Progress.
 */
@Component({
  selector: 'app-action-center-card',
  standalone: true,
  imports: [KeyboardClickDirective, StopClickPropagationDirective, AvatarComponent, ErrorStateComponent, PopoutPanelComponent, PopoutHeaderActionsComponent],
  templateUrl: './action-center-card.component.html',
  styleUrl: './action-center-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionCenterCardComponent implements OnInit {
  protected readonly store = inject(MyTeamActionItemsStore);
  private readonly ledProgressStore = inject(MyTeamLedProgressStore);
  private readonly router = inject(Router);
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);
  private readonly deepLink = inject(MyTeamDeepLinkService);
  private readonly authStore = inject(AuthStore);
  private readonly decisions = inject(ActionCenterDecisionService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly directory = inject(EmployeeDirectoryStore);

  private readonly now = signal(new Date());
  private clockId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();

  protected readonly showRail = computed(() => actionCenterRailVisible(this.capabilitiesStore.capabilities()));

  protected readonly subtitle = computed<string | null>(() => {
    const caps = this.capabilitiesStore.capabilities();
    const hasPeople = !!caps && (caps.canReviewPeopleApprovals || caps.canReviewExceptions);
    const hasWork = !!caps && (caps.hasWorkApprovals || caps.leadsWork);
    if (hasPeople && hasWork) return null;
    if (hasPeople) return 'People you manage';
    if (hasWork) return 'Work you lead';
    return null;
  });

  // --- Inbox ---

  protected readonly filter = signal<InboxFilter>('all');
  protected readonly showAll = signal(false);

  /** Rows decided from the card - hidden at once, before the refreshed list arrives. */
  private readonly decidedKeys = signal<ReadonlySet<string>>(new Set());

  protected readonly inbox = computed(() => {
    const decided = this.decidedKeys();
    return buildActionInbox(this.store.data(), this.ledProgressStore.data(), this.now(), this.authStore.employeeId())
      .filter((item) => !decided.has(item.key));
  });
  /** The backend's real pending totals - never shrink to the rows loaded. */
  protected readonly counts = computed(() => inboxCounts(this.store.data(), this.ledProgressStore.data(), this.inbox()));

  /** Only the filters this viewer can have something in. */
  protected readonly chips = computed<FilterChip[]>(() => {
    const counts = this.counts();
    const sources = this.store.data()?.sources ?? [];
    const chips: FilterChip[] = [{ key: 'all', label: 'All', count: counts.all }];
    if (sources.some((s) => !isExceptionSource(s.sourceKey))) chips.push({ key: 'approval', label: 'Approvals', count: counts.approval });
    if (sources.some((s) => isExceptionSource(s.sourceKey))) chips.push({ key: 'exception', label: 'Alerts', count: counts.exception });
    if (this.ledProgressStore.data() && this.capabilitiesStore.capabilities()?.leadsWork) {
      chips.push({ key: 'overdue', label: 'Overdue', count: counts.overdue });
    }
    return chips;
  });

  protected readonly filtered = computed(() => filterInbox(this.inbox(), this.filter()));
  protected readonly visibleRows = computed(() =>
    this.showAll() ? this.filtered() : this.filtered().slice(0, CARD_ROW_LIMIT)
  );
  /** The real pending total for the active filter - the backend sends only the oldest few rows. */
  protected readonly filterTotal = computed(() => {
    const counts = this.counts();
    const filter = this.filter();
    return Math.max(filter === 'all' ? counts.all : counts[filter], this.filtered().length);
  });
  protected readonly hiddenCount = computed(() => Math.max(0, this.filterTotal() - CARD_ROW_LIMIT));
  protected readonly canExpand = computed(() => Math.max(this.counts().all, this.inbox().length) > CARD_ROW_LIMIT);
  /** More are pending than the backend sent rows for - said in the pop-out, never hidden. */
  protected readonly notLoadedCount = computed(() => Math.max(0, this.counts().all - this.inbox().length));
  /** A type that failed to load: its items are missing, so say so. */
  protected readonly unavailableCount = computed(
    () => (this.store.data()?.sources ?? []).filter((s) => s.status === 'unavailable').length
  );

  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());
  protected readonly loading = computed(
    () =>
      (this.showRail() && this.store.loading() && !this.store.data()) ||
      (this.ledProgressStore.loading() && !this.ledProgressStore.data())
  );
  protected readonly errored = computed(
    () =>
      (this.showRail() && !!this.store.error() && !this.store.data()) ||
      (!!this.ledProgressStore.error() && !this.ledProgressStore.data())
  );

  setFilter(key: InboxFilter, event: Event): void {
    event.stopPropagation();
    this.filter.set(key);
  }

  ageClass = inboxAgeClass;
  badge = inboxBadge;

  /** Who each row is about, as a stable string, so the photo lookup reruns only when the people change. */
  private readonly subjectIds = computed(
    () => [...new Set(this.inbox().map((item) => item.subjectEmployeeId).filter((id): id is string => !!id))].sort().join(','),
    { equal: (a, b) => a === b }
  );

  constructor() {
    effect(() => {
      const ids = this.subjectIds();
      if (ids) void this.directory.ensureLoaded(ids.split(','));
    });
  }

  avatarUrl(item: InboxItem): string | null {
    return item.subjectEmployeeId ? this.directory.get(item.subjectEmployeeId)?.avatarUrl ?? null : null;
  }

  // --- Approve / Reject ---

  protected readonly commentMax = DECISION_COMMENT_MAX;
  protected readonly form = signal<DecisionForm | null>(null);
  protected readonly comment = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly busyKey = signal<string | null>(null);
  protected readonly rowErrors = signal<Readonly<Record<string, string>>>({});

  /** Approve / Reject only on approvals - exceptions and overdue tasks just open. */
  canDecide(item: InboxItem): boolean {
    return item.kind === 'approval' && canDecideInline(item.sourceKey);
  }

  formLabel(item: InboxItem): string {
    if (this.form()?.mode === 'approve') return 'Comment (optional)';
    return rejectReasonRequired(item.sourceKey) ? 'Reason for rejecting (required)' : 'Reason for rejecting (optional)';
  }

  startDecision(item: InboxItem, mode: ApprovalDecision, event: Event): void {
    event.stopPropagation();
    this.form.set({ key: item.key, mode });
    this.comment.set('');
    this.formError.set(null);
  }

  cancelDecision(event: Event): void {
    event.stopPropagation();
    if (this.busyKey()) return;
    this.form.set(null);
    this.formError.set(null);
  }

  async confirmDecision(item: InboxItem, event: Event): Promise<void> {
    event.stopPropagation();
    const form = this.form();
    if (!form || form.key !== item.key || this.busyKey()) return;
    const text = this.comment().trim();
    if (form.mode === 'reject' && rejectReasonRequired(item.sourceKey) && !text) {
      this.formError.set('Add a reason before rejecting this request.');
      return;
    }
    if (text.length > DECISION_COMMENT_MAX) {
      this.formError.set(`Keep it to ${DECISION_COMMENT_MAX} characters or fewer.`);
      return;
    }
    this.formError.set(null);
    this.busyKey.set(item.key);
    this.setRowError(item.key, null);
    try {
      await this.decisions.decide(item.sourceKey, item.entityId, form.mode, text || null);
      this.form.set(null);
      this.decidedKeys.update((keys) => new Set([...keys, item.key]));
      this.notifications.success(`${item.tag} request ${form.mode === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (err) {
      const message = decisionErrorMessage(err);
      this.setRowError(item.key, message);
      this.notifications.error(message);
    } finally {
      this.busyKey.set(null);
      // Either way, show the truth: the new count after a decision, or the latest state after a conflict.
      void this.store.load();
    }
  }

  private setRowError(key: string, message: string | null): void {
    this.rowErrors.update((errors) => {
      const next = { ...errors };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }

  /** The row's arrow (or title) opens its own screen: the request, the alert, or the task's board. */
  async openItem(item: InboxItem, event: Event): Promise<void> {
    event.stopPropagation();
    if (item.overdueTask) {
      await this.router.navigate(
        ['/work', item.overdueTask.projectId, 'milestones', item.overdueTask.objectiveId, 'board'],
        { queryParams: { highlightTaskId: item.overdueTask.taskId } }
      );
      return;
    }
    if (item.link) await this.deepLink.navigate(item.link);
  }

  /** A click anywhere on the card pops out the full inbox - only when there is more to show. */
  expand(): void {
    if (!this.showAll() && this.canExpand()) this.showAll.set(true);
  }

  collapse(): void {
    this.showAll.set(false);
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.collapse();
    else this.expand();
  }

  // --- Lifecycle / reloads (owns MyTeamActionItemsStore, conditional on the viewer having approvals) ---

  ngOnInit(): void {
    if (this.showRail()) {
      void this.store.load();
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
    this.startClock();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopClock();
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.store.load();
      this.now.set(new Date());
      this.startClock();
    } else {
      this.stopClock();
    }
  }

  private startClock(): void {
    if (this.clockId) return;
    this.clockId = setInterval(() => this.now.set(new Date()), CLOCK_TICK_MS);
  }

  private stopClock(): void {
    if (this.clockId) {
      clearInterval(this.clockId);
      this.clockId = null;
    }
  }

  retry(): void {
    if (this.showRail()) void this.store.load();
    void this.ledProgressStore.load();
  }
}

function decisionErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = safeServerDetail(err);
    if (detail) return detail;
    if (err.status === 409) return 'Someone already decided this request. The list has been refreshed.';
    if (err.status === 403) return "You can't decide this request.";
  }
  return "Couldn't save the decision. Try again.";
}
