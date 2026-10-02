import { AfterViewInit, Component, computed, effect, ElementRef, HostListener, inject, OnDestroy, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { WorkApprovalsStore } from '../../state/work-approvals.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { TaskFilterBarComponent } from '../../ui/task-filter-bar/task-filter-bar.component';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';
import { DatePipe } from '@angular/common';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { ApprovalTypeIconComponent } from '../../ui/approval-type-icon/approval-type-icon.component';
import { ApprovalExplanationCardComponent } from '../../ui/approval-explanation-card/approval-explanation-card.component';
import { ApprovalFeedItemDto } from '../../models/dto/approval-feed.dto';
import {
  APPROVAL_TYPE_META,
  ApprovalFilterValues,
  approvalMenuItems,
  approvalSubtitle,
  approvalTitle,
  approvalTypeKey,
  buildApprovalFilterFields,
  matchesApprovalFilters,
  statusLabel,
  statusTone
} from '../../utils/approval-feed.util';

const DEFAULT_FILTERS: ApprovalFilterValues = { direction: ['all'], requestedOn: ['any'] };

const APPROVAL_COLUMNS: readonly DataTableColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type', width: '150px' },
  { key: 'requestedBy', label: 'Requested by', width: '30%' },
  { key: 'status', label: 'Status', width: '112px' },
  { key: 'actions', label: 'Actions', width: '52px', interactive: true, align: 'end', hideLabel: true }
];

/** One list of every request the caller sent or received in this project, with an explanation card for the selected row. */
@Component({
  selector: 'app-work-approvals',
  standalone: true,
  imports: [
    DatePipe, TaskFilterBarComponent, DataTableComponent, DataTableCellDirective, AvatarComponent, DropdownMenuComponent,
    ApprovalTypeIconComponent, ApprovalExplanationCardComponent, TaskFormModalComponent, ModalComponent, InputComponent,
    WorkDropdownComponent, ButtonComponent
  ],
  template: `
    <ng-template #toolbarTpl>
      <div class="work-approvals__toolbar-actions">
        <app-task-filter-bar
          [fields]="filterFields()"
          [values]="filterValues()"
          (fieldChanged)="onFilterChanged($event)"
        />
        <app-button data-testid="create-approval-button" variant="primary" (pressed)="openCreateApproval()">
          <svg class="work-approvals__btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Create Approval
        </app-button>
      </div>
    </ng-template>

    <div class="work-approvals" [class.work-approvals--with-card]="store.selectedId() !== null">
      <div class="work-approvals__main">
        @if (store.loading() && store.items().length === 0) {
          <p class="work-approvals__state" data-testid="approvals-loading" aria-live="polite">Loading approvals…</p>
        } @else if (store.error() && store.items().length === 0) {
          <div class="work-approvals__state work-approvals__state--error" role="alert" data-testid="approvals-error">
            <span>{{ store.error() }}</span>
            <button type="button" (click)="retry()">Try again</button>
          </div>
        } @else {
          <app-data-table
            data-testid="approval-table"
            [columns]="columns"
            [rows]="visible()"
            [trackBy]="trackItem"
            [rowTestId]="rowTestId"
            [activeRowId]="store.selectedId()"
            [busyRowId]="busyId()"
            [rowFocusable]="true"
            [emptyMessage]="store.items().length === 0 ? 'No approval requests in this project yet.' : 'No requests match these filters.'"
            (rowClicked)="onSelect($event)"
          >
            <ng-template appDataTableCell="title" let-item>
              <div class="work-approvals__title-cell">
                <app-approval-type-icon [icon]="meta(item).icon" [tone]="meta(item).tone" />
                <div class="work-approvals__title-text">
                  <span class="work-approvals__title">
                    <span class="work-approvals__ellipsis">{{ title(item) }}</span>
                    @if (item.commentCount > 0) {
                      <span class="work-approvals__comments" data-testid="approval-row-comments" [attr.aria-label]="item.commentCount + ' comments'">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
                        {{ item.commentCount }}
                      </span>
                    }
                  </span>
                  <span class="work-approvals__secondary work-approvals__ellipsis">{{ subtitle(item) }}</span>
                </div>
              </div>
            </ng-template>

            <ng-template appDataTableCell="type" let-item>
              <span [class]="'work-approvals__pill work-approvals__pill--' + meta(item).tone">{{ meta(item).label }}</span>
            </ng-template>

            <ng-template appDataTableCell="requestedBy" let-item>
              <span class="work-approvals__person">
                <app-avatar [userName]="item.requestedByName" size="sm" />
                <span class="work-approvals__person-text">
                  <span class="work-approvals__ellipsis">{{ item.requestedByName }}</span>
                  <span class="work-approvals__secondary work-approvals__ellipsis">{{ item.createdAt | date: 'MMM d, y · h:mm a' }}</span>
                </span>
              </span>
            </ng-template>

            <ng-template appDataTableCell="status" let-item>
              <span data-testid="approval-status" [class]="'work-approvals__pill work-approvals__pill--' + tone(item)">{{ status(item) }}</span>
            </ng-template>

            <ng-template appDataTableCell="actions" let-item>
              <app-dropdown-menu [items]="menuFor(item)" ariaLabel="Request actions" (selected)="onRowMenu(item, $event)">
                <button menu-trigger type="button" class="work-approvals__kebab" data-testid="approval-row-menu" aria-label="Request actions">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
                </button>
              </app-dropdown-menu>
            </ng-template>
          </app-data-table>
        }
      </div>

      @if (store.selectedId() !== null) {
        <div class="work-approvals__scrim" aria-hidden="true" (click)="closeCard()"></div>
        <div #cardEl class="work-approvals__card" [style.--approvals-card-height]="cardHeight()">
          <app-approval-explanation-card
            [detail]="store.detail()"
            [loading]="store.detailLoading()"
            [error]="store.detailError()"
            [comments]="store.comments()"
            [commentsLoading]="store.commentsLoading()"
            [busy]="store.busy()"
            (closed)="closeCard()"
            (approve)="onCardApprove($event)"
            (reject)="onCardReject($event)"
            (cancelRequest)="onCardCancel()"
            (openTarget)="onCardOpenTarget()"
            (addComment)="store.addComment($event)"
            (replyComment)="store.reply($event.parentId, $event.content)"
            (editComment)="store.editComment($event.id, $event.content)"
          />
        </div>
      }
    </div>

    @if (createOpen()) {
      <app-modal
        data-testid="create-approval-modal"
        [open]="true"
        title="Create Approval"
        (closed)="closeCreateApproval()"
      >
        <div class="work-approvals__form">
          <app-work-dropdown
            [options]="moduleOptions()"
            [selected]="createModuleId()"
            fieldLabel="Module"
            placeholder="Select a module"
            [error]="createErrors()['module'] || ''"
            leadingIcon="module"
            [fullWidth]="true"
            (selectionChanged)="createModuleId.set($event)"
          />
          <app-input
            label="Requested additional hours"
            type="number"
            [value]="createHours()"
            [error]="createErrors()['hours'] || ''"
            (valueChange)="createHours.set($event)"
          />
          <app-input
            label="Reason"
            [value]="createReason()"
            [error]="createErrors()['reason'] || ''"
            (valueChange)="createReason.set($event)"
          />
          @if (createError()) {
            <p class="work-approvals__error" role="alert">{{ createError() }}</p>
          }
          <div class="work-approvals__form-actions">
            <app-button variant="secondary" (pressed)="closeCreateApproval()">Cancel</app-button>
            <app-button data-testid="create-approval-submit" variant="primary" [disabled]="creating()" (pressed)="submitCreateApproval()">
              {{ creating() ? 'Submitting…' : 'Submit Approval' }}
            </app-button>
          </div>
        </div>
      </app-modal>
    }

    <app-task-form-modal
      [open]="selectedTaskId() !== null"
      mode="edit"
      [projectId]="projectId()"
      [taskId]="selectedTaskId() ?? ''"
      (changed)="store.loadAll(projectId())"
      (saved)="onTaskDetailsClosed()"
      (closed)="selectedTaskId.set(null)"
    />
  `,
  styles: [`
    :host { display: block; }
    /* Same split and outer spacing as the Tree tab: list + a 24rem explanation card, no extra page padding. */
    .work-approvals { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 16px; width: 100%; }
    .work-approvals--with-card { grid-template-columns: minmax(0, 1fr) 24rem; }
    .work-approvals__main { display: flex; min-width: 0; flex-direction: column; gap: 16px; }
    /* The card runs to the bottom of the viewport (height measured in the class) so its actions sit at the bottom edge. */
    .work-approvals__card { position: sticky; top: 16px; align-self: start; min-width: 0; height: var(--approvals-card-height, calc((100vh - 220px) * 0.9)); min-height: 420px; }
    .work-approvals__scrim { display: none; }
    .work-approvals__state { display: flex; align-items: center; gap: 8px; margin: 0; padding: 24px 0; color: var(--color-text-secondary); font-size: 13px; }
    .work-approvals__state--error { color: var(--color-danger); }
    .work-approvals__state button { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-weight: 650; text-decoration: underline; cursor: pointer; }
    .work-approvals__error { margin: 0; color: var(--color-danger); }
    .work-approvals__form { display: flex; flex-direction: column; gap: 14px; }
    .work-approvals__form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .work-approvals__toolbar-actions { display: flex; align-items: center; gap: 8px; }
    .work-approvals__btn-icon { width: 16px; height: 16px; margin-right: 4px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    @media (max-width: 1023px) {
      .work-approvals--with-card { grid-template-columns: minmax(0, 1fr); }
      .work-approvals__scrim { position: fixed; inset: 0; z-index: 1000; display: block; background: color-mix(in srgb, var(--color-text-primary) 35%, transparent); }
      .work-approvals__card { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1001; width: min(24rem, 100vw); height: auto; min-height: 0; padding: 8px; }
    }
    .work-approvals__title-cell { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .work-approvals__title-text, .work-approvals__person-text { display: flex; min-width: 0; flex-direction: column; }
    .work-approvals__title { display: flex; min-width: 0; align-items: center; gap: 8px; font-weight: 600; }
    .work-approvals__ellipsis { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .work-approvals__secondary { color: var(--color-text-secondary); font-size: 12px; }
    .work-approvals__comments { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 3px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .work-approvals__comments svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
    .work-approvals__person { display: flex; min-width: 0; align-items: center; gap: 8px; }
    .work-approvals__person app-avatar { flex: 0 0 auto; }
    .work-approvals__pill { --tone: var(--color-accent); display: inline-block; max-width: 100%; overflow: hidden; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .work-approvals__pill--neutral { --tone: var(--color-text-secondary); }
    .work-approvals__kebab { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .work-approvals__kebab:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .work-approvals__kebab svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  `]
})
export class WorkApprovalsComponent implements AfterViewInit, OnDestroy {
  protected readonly store = inject(WorkApprovalsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly approvalsApi = inject(WorkApprovalsApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly notifications = inject(NotificationService);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');
  protected readonly projectId = signal('');
  private readonly cardEl = viewChild<ElementRef<HTMLElement>>('cardEl');
  /** Viewport height left below the card's top edge, so the card ends near the bottom of the screen. */
  protected readonly cardHeight = signal<string | null>(null);

  protected readonly columns = APPROVAL_COLUMNS;
  protected readonly trackItem = (item: ApprovalFeedItemDto): string => item.source + ':' + item.id;
  protected readonly rowTestId = (): string => 'approval-row';

  protected readonly filterValues = signal<ApprovalFilterValues>(DEFAULT_FILTERS);
  protected readonly filterFields = computed(() => buildApprovalFilterFields(this.store.items()));
  protected readonly visible = computed(() => this.store.items().filter((i) => matchesApprovalFilters(i, this.filterValues())));
  protected readonly busyId = signal<string | null>(null);
  protected readonly selectedTaskId = signal<string | null>(null);
  /** On narrow screens the card is a drawer the user closes; don't reopen it on its own. */
  private readonly userClosedCard = signal(false);
  /** ?request=<id> waiting for the feed to load. */
  private readonly pendingDeepLink = signal<string | null>(this.route.snapshot?.queryParamMap?.get('request') ?? null);

  protected readonly createOpen = signal(false);
  protected readonly creating = signal(false);
  protected readonly createModuleId = signal('');
  protected readonly createHours = signal('');
  protected readonly createReason = signal('');
  protected readonly createError = signal<string | null>(null);
  protected readonly createErrors = signal<Record<string, string>>({});
  protected readonly modules = signal<readonly { objectiveId: string; title: string; isOwner?: boolean }[]>([]);
  protected readonly moduleOptions = signal<readonly WorkDropdownOption[]>([]);
  private prefillObjectiveId: string | null = null;

  constructor() {
    // Switching projects via the breadcrumb switcher navigates to a sibling route matching the
    // same path shape (/work/:id/approvals) - Angular reuses this component instance rather than
    // re-instantiating it, so the :id param must be watched reactively, not just read once.
    if (this.route.paramMap) {
      this.route.paramMap
        .pipe(
          map((paramMap) => paramMap.get('id') ?? ''),
          distinctUntilChanged(),
          takeUntilDestroyed()
        )
        .subscribe((projectId) => this.onProjectChanged(projectId));
    } else {
      this.onProjectChanged(this.route.snapshot?.paramMap?.get('id') ?? '');
    }

    // The card mounts once a row is selected - size it then.
    effect(() => {
      if (this.cardEl()) queueMicrotask(() => this.measureCard());
    });

    // Once the feed has loaded: open ?request=<id> if given, otherwise keep a row selected -
    // the first visible one by default, or when a filter hides the selected row.
    effect(() => {
      if (this.store.loading() || this.store.projectId() !== this.projectId()) return;
      const deepLink = this.pendingDeepLink();
      if (deepLink) {
        this.pendingDeepLink.set(null);
        const item = this.store.items().find((i) => i.id === deepLink);
        if (item) {
          void this.store.select(item);
          return;
        }
      }
      const visible = this.visible();
      const selectedId = this.store.selectedId();
      if (visible.length === 0 || visible.some((i) => i.id === selectedId)) return;
      if (selectedId === null && (this.userClosedCard() || !this.isWideScreen())) return;
      void this.store.select(visible[0]);
    });
  }

  ngAfterViewInit(): void {
    this.toolbarStore.setTemplate(this.toolbarTpl());
  }

  @HostListener('window:resize')
  protected measureCard(): void {
    const el = this.cardEl()?.nativeElement;
    if (!el || typeof window === 'undefined') return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    // Space left below the card (16px breathing room, mirroring the sticky top offset), minus 10%.
    this.cardHeight.set(`${Math.max(420, Math.round((window.innerHeight - top - 16) * 0.9))}px`);
  }

  protected meta(item: ApprovalFeedItemDto) { return APPROVAL_TYPE_META[approvalTypeKey(item.actionType)]; }
  protected title(item: ApprovalFeedItemDto): string { return approvalTitle(item); }
  protected subtitle(item: ApprovalFeedItemDto): string { return approvalSubtitle(item); }
  protected status(item: ApprovalFeedItemDto): string { return statusLabel(item); }
  protected tone(item: ApprovalFeedItemDto): string { return statusTone(item); }
  protected menuFor(item: ApprovalFeedItemDto): MenuItem[] { return approvalMenuItems(item); }

  onRowMenu(item: ApprovalFeedItemDto, id: string): void {
    switch (id) {
      case 'view': this.onSelect(item); break;
      case 'approve': void this.onQuickApprove(item); break;
      case 'open': this.onOpenTarget(item); break;
      case 'cancel': void this.onCancel(item); break;
      case 'copy': void this.onCopyLink(item); break;
    }
  }

  ngOnDestroy(): void {
    this.toolbarStore.setTemplate(null);
  }

  private onProjectChanged(projectId: string): void {
    const switching = this.projectId() !== '' && this.projectId() !== projectId;
    this.projectId.set(projectId);
    if (switching) {
      this.filterValues.set(DEFAULT_FILTERS);
      this.pendingDeepLink.set(null);
    }
    void this.store.select(null);
    if (!projectId) return;
    void this.loadModules();
    // The project shell loads the feed for the Approvals badge - only load here if it hasn't.
    if (this.store.projectId() !== projectId) void this.store.loadAll(projectId);
  }

  protected onFilterChanged(event: { key: string; values: string[] }): void {
    this.filterValues.update((v) => ({ ...v, [event.key]: event.values }));
  }

  protected retry(): void {
    void this.store.loadAll(this.projectId());
  }

  protected onSelect(item: ApprovalFeedItemDto): void {
    this.userClosedCard.set(false);
    void this.store.select(item);
    this.setRequestParam(item.id);
  }

  protected closeCard(): void {
    this.userClosedCard.set(true);
    void this.store.select(null);
    this.setRequestParam(null);
  }

  /** Wide screens show the card beside the list (always open); narrow ones use a drawer. */
  private isWideScreen(): boolean {
    return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      || window.matchMedia('(min-width: 1024px)').matches;
  }

  private setRequestParam(id: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { request: id, tab: null },
      queryParamsHandling: 'merge', replaceUrl: true
    })?.catch(() => undefined);
  }

  protected async onQuickApprove(item: ApprovalFeedItemDto): Promise<void> {
    this.busyId.set(item.id);
    const ok = await this.store.approve(item);
    this.busyId.set(null);
    if (ok) this.notifications.success(item.source === 'invitation' ? 'Accepted' : 'Approved');
    else this.notifications.error(this.store.detailError() ?? 'Failed to approve.');
  }

  protected async onCancel(item: ApprovalFeedItemDto): Promise<void> {
    this.busyId.set(item.id);
    const ok = await this.store.cancel(item);
    this.busyId.set(null);
    if (ok) this.notifications.success('Request cancelled');
    else this.notifications.error(this.store.detailError() ?? 'Failed to cancel the request.');
  }

  protected onOpenTarget(item: ApprovalFeedItemDto): void {
    if (!item.targetId) return;
    if (item.targetType === 'task') {
      this.selectedTaskId.set(item.targetId);
    } else if (item.targetType === 'module') {
      void this.router.navigate(['/work', this.projectId(), 'milestones', item.targetId, 'tree']);
    }
  }

  protected async onCopyLink(item: ApprovalFeedItemDto): Promise<void> {
    const url = `${location.origin}/work/${this.projectId()}/approvals?request=${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
      this.notifications.success('Link copied');
    } catch {
      this.notifications.error('Could not copy the link.');
    }
  }

  protected onCardApprove(editedPayloadJson: string | undefined): void {
    const item = this.store.detail()?.item;
    if (item) void this.store.approve(item, editedPayloadJson);
  }

  protected onCardReject(reason: string | null): void {
    const item = this.store.detail()?.item;
    if (item) void this.store.reject(item, reason ?? undefined);
  }

  protected onCardCancel(): void {
    const item = this.store.detail()?.item;
    if (item) void this.store.cancel(item);
  }

  protected onCardOpenTarget(): void {
    const item = this.store.detail()?.item;
    if (item) this.onOpenTarget(item);
  }

  onTaskDetailsClosed(): void {
    this.selectedTaskId.set(null);
    void this.store.loadAll(this.projectId());
  }

  openCreateApproval(objectiveId?: string): void {
    this.prefillObjectiveId = objectiveId ?? null;
    this.createOpen.set(true);
    this.createError.set(null);
    this.createErrors.set({});
    if (objectiveId && this.modules().some((module) => module.objectiveId === objectiveId)) {
      this.createModuleId.set(objectiveId);
    } else if (!objectiveId) {
      this.createModuleId.set('');
    }
  }

  closeCreateApproval(): void {
    this.createOpen.set(false);
    this.createError.set(null);
    this.createErrors.set({});
    this.createHours.set('');
    this.createReason.set('');
    this.createModuleId.set('');
    this.prefillObjectiveId = null;
  }

  async submitCreateApproval(): Promise<void> {
    const errors: Record<string, string> = {};
    const hours = Number(this.createHours());
    if (!this.createModuleId()) errors['module'] = 'Select a module.';
    if (!Number.isFinite(hours) || hours <= 0) errors['hours'] = 'Hours must be greater than zero.';
    if (!this.createReason().trim()) errors['reason'] = 'Reason is required.';
    this.createErrors.set(errors);
    this.createError.set(null);
    if (Object.keys(errors).length > 0) return;

    this.creating.set(true);
    try {
      await firstValueFrom(this.approvalsApi.createAllocationRequest(this.createModuleId(), {
        requestedAdditionalHours: hours,
        reason: this.createReason().trim()
      }));
      this.closeCreateApproval();
      await this.store.loadAll(this.projectId());
    } catch (err: any) {
      this.createError.set(err?.error?.detail || err?.error?.message || err?.message || 'Failed to create approval request.');
    } finally {
      this.creating.set(false);
    }
  }

  private async loadModules(): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;
    try {
      const modules = await firstValueFrom(this.projectApi.getMyMilestones(projectId));
      const normalized = modules.map((module) => ({
        objectiveId: module.objectiveId,
        title: module.title,
        isOwner: module.isOwner
      }));
      this.modules.set(normalized);
      this.moduleOptions.set(normalized.map((module) => ({ value: module.objectiveId, label: module.title })));
      if (this.prefillObjectiveId && normalized.some((module) => module.objectiveId === this.prefillObjectiveId)) {
        this.createModuleId.set(this.prefillObjectiveId);
      }
    } catch (err: any) {
      this.createError.set(err?.error?.detail || err?.error?.message || err?.message || 'Failed to load modules.');
    }
  }
}
