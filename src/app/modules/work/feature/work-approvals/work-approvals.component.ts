import { DatePipe } from '@angular/common';
import { AfterViewInit, Component, computed, inject, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { WorkApprovalsStore } from '../../state/work-approvals.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { ApprovalItem } from '../../models/approval.model';
import { AllocationRequestDto, EditObjectiveRequestPayloadDto } from '../../models/dto/allocation-request.dto';
import { ApprovalRequestRowComponent } from '../../ui/approval-request-row/approval-request-row.component';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ApprovalHistoryItemDto } from '../../models/dto/approval-history.dto';
import { ApprovalHistoryModalComponent } from '../../ui/approval-history-modal/approval-history-modal.component';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';

@Component({
  selector: 'app-work-approvals',
  standalone: true,
  imports: [DatePipe, ApprovalRequestRowComponent, ApprovalHistoryModalComponent, TaskFormModalComponent, ModalComponent, InputComponent, WorkDropdownComponent, ButtonComponent],
  template: `
    <ng-template #toolbarTpl>
      <div class="work-approvals__toolbar-actions">
        <app-button data-testid="approval-history-button" variant="secondary" (pressed)="openHistory()">
          History
        </app-button>
        <app-button data-testid="create-approval-button" variant="primary" (pressed)="openCreateApproval()">
          Create Approval
        </app-button>
      </div>
    </ng-template>

    @if (store.loading()) {
      <p>Loading approvals…</p>
    } @else if (store.error() && store.pendingCount() === 0) {
      <p class="work-approvals__error">{{ store.error() }}</p>
    } @else {
      <div class="work-approvals">
        @if (sentPendingRequests().length > 0) {
        <section data-testid="my-pending-requests">
          <h2>My Pending Requests <span>{{ sentPendingRequests().length }}</span></h2>
          @for (item of sentPendingRequests(); track item.kind + '-' + item.id) {
            <article class="sent-approval-row" [attr.data-testid]="'sent-pending-request-' + item.id">
              <div class="sent-approval-row__body">
                <p class="sent-approval-row__kind">{{ historyKindLabel(item.kind) }}</p>
                <p class="sent-approval-row__title">{{ item.subjectTitle }}</p>
                @if (item.detail) {
                  <p class="sent-approval-row__detail">{{ item.detail }}</p>
                }
                <p class="sent-approval-row__meta">
                  Sent to <strong>{{ item.approverName }}</strong>
                  <span> · {{ item.createdAt | date: 'MMM d, y' }}</span>
                </p>
              </div>
              <div class="sent-approval-row__status-wrap">
                <span class="sent-approval-row__status">Pending</span>
                <span>Awaiting {{ item.approverName }}</span>
              </div>
            </article>
          }
        </section>
        } @else if (historyLoading()) {
          <p class="work-approvals__supporting-state" aria-live="polite">Loading your pending requests…</p>
        } @else if (historyError()) {
          <div class="work-approvals__supporting-state work-approvals__supporting-state--error" role="alert">
            <span>{{ historyError() }}</span>
            <button type="button" (click)="loadHistory()">Try again</button>
          </div>
        }

        @if (taskCreationRequests().length > 0) {
        <section>
          <h2>Task Creation Requests <span>{{ taskCreationRequests().length }}</span></h2>
          @for (item of taskCreationRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
              (viewRequested)="onViewTarget($event)"
            />
          }
        </section>
        }

        @if (taskEditRequests().length > 0) {
        <section>
          <h2>Task Edit Requests <span>{{ taskEditRequests().length }}</span></h2>
          @for (item of taskEditRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
              (viewRequested)="onViewTarget($event)"
            />
          }
        </section>
        }

        @if (allocationRequests().length > 0) {
        <section>
          <h2>Allocation Requests <span>{{ allocationRequests().length }}</span></h2>
          @for (item of allocationRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              [inlineError]="activeErrorFor(item)"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
              (requestOwnAllocation)="onRequestOwnAllocation(item)"
              (viewRequested)="onViewTarget($event)"
            />
          }
        </section>
        }

        @if (objectiveChangeRequests().length > 0) {
        <section>
          <h2>Objective Change Requests <span>{{ objectiveChangeRequests().length }}</span></h2>
          @for (item of objectiveChangeRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
              (viewRequested)="onViewTarget($event)"
            />
          }
        </section>
        }

        @if (objectiveInvitations().length > 0) {
        <section>
          <h2>Objective Invitations <span>{{ objectiveInvitations().length }}</span></h2>
          @for (item of objectiveInvitations(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
              (viewRequested)="onViewTarget($event)"
            />
          }
        </section>
        }

        @if (visiblePendingCount() === 0 && !historyLoading() && !historyError()) {
          <div class="work-approvals__empty" data-testid="approvals-empty-state">
            <p>No pending approvals or requests.</p>
          </div>
        }
      </div>
    }

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

    <app-approval-history-modal
      [open]="historyOpen()"
      [items]="historyItems()"
      [loading]="historyLoading()"
      [error]="historyError()"
      (closed)="historyOpen.set(false)"
      (retry)="loadHistory()"
    />

    <app-task-form-modal
      [open]="selectedTaskId() !== null"
      mode="edit"
      [projectId]="projectId()"
      [taskId]="selectedTaskId() ?? ''"
      (changed)="store.loadAll()"
      (saved)="onTaskDetailsClosed()"
      (closed)="selectedTaskId.set(null)"
    />
  `,
  styles: [`
    .work-approvals { display: flex; flex-direction: column; gap: 18px; width: min(100%, 1180px); margin: 0 auto; padding: 8px 20px 28px; }
    .work-approvals h2 { margin: 0; color: var(--color-text-primary); }
    .work-approvals h2 { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 650; }
    .work-approvals h2 span { display: inline-flex; min-width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 650; }
    .work-approvals section { display: flex; flex-direction: column; gap: 10px; }
    @media (max-width: 680px) { .work-approvals { padding-inline: 12px; } }
    .work-approvals__error { color: var(--color-danger); }
    .work-approvals__form { display: flex; flex-direction: column; gap: 14px; }
    .work-approvals__form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .work-approvals__toolbar-actions { display: flex; align-items: center; gap: 8px; }
    .sent-approval-row { display: flex; align-items: center; justify-content: space-between; gap: 22px; min-height: 82px; padding: 12px 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: 0 2px 8px rgb(15 23 42 / .035); }
    .sent-approval-row__body { min-width: 0; }
    .sent-approval-row__kind { margin: 0 0 3px; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .sent-approval-row__title { margin: 0; color: var(--color-text-primary); font-size: 14px; font-weight: 650; }
    .sent-approval-row__detail, .sent-approval-row__meta { margin: 3px 0 0; color: var(--color-text-secondary); font-size: 12px; line-height: 1.4; }
    .sent-approval-row__meta strong { color: var(--color-text-primary); font-weight: 600; }
    .sent-approval-row__status-wrap { display: flex; flex: 0 0 170px; flex-direction: column; align-items: flex-end; gap: 5px; color: var(--color-text-secondary); font-size: 11px; text-align: right; }
    .sent-approval-row__status { display: inline-flex; padding: 4px 9px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; }
    .work-approvals__supporting-state { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--color-text-secondary); font-size: 12px; }
    .work-approvals__supporting-state--error { color: var(--color-danger-text); }
    .work-approvals__supporting-state button { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-weight: 650; text-decoration: underline; cursor: pointer; }
    .work-approvals__empty { display: flex; min-height: 180px; align-items: center; justify-content: center; color: var(--color-text-secondary); font-size: 13px; }
    @media (max-width: 680px) { .sent-approval-row { align-items: flex-start; flex-direction: column; } .sent-approval-row__status-wrap { flex-basis: auto; align-items: flex-start; text-align: left; } }
  `]
})
export class WorkApprovalsComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly store = inject(WorkApprovalsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly approvalsApi = inject(WorkApprovalsApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');
  protected readonly projectId = signal('');
  private lastFailedId: string | null = null;

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
  protected readonly historyOpen = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly historyItems = signal<readonly ApprovalHistoryItemDto[]>([]);
  protected readonly selectedTaskId = signal<string | null>(null);
  private historyLoadVersion = 0;

  // The store's "mine" lists span every project the caller owns modules in; scope each one down
  // to this project's modules so a project's Approvals page only shows that project's requests.
  private readonly moduleIds = computed(() => new Set(this.modules().map((m) => m.objectiveId)));
  private readonly scopedToProject = (items: readonly ApprovalItem[]) => {
    const moduleTitles = new Map(this.modules().map((module) => [module.objectiveId, module.title]));
    return items
      .filter((item) => this.moduleIds().has(item.objectiveId))
      .map((item) => item.targetType === 'module' && !item.targetTitle
        ? { ...item, targetTitle: moduleTitles.get(item.objectiveId) ?? null }
        : item);
  };

  protected readonly taskCreationRequests = computed(() => this.scopedToProject(this.store.taskCreationRequests()));
  protected readonly taskEditRequests = computed(() => this.scopedToProject(this.store.taskEditRequests()));
  protected readonly allocationRequests = computed(() => this.scopedToProject(this.store.allocationRequests()));
  protected readonly objectiveChangeRequests = computed(() => this.scopedToProject(this.store.objectiveChangeRequests()));
  protected readonly objectiveInvitations = computed(() => this.scopedToProject(this.store.objectiveInvitations()));
  protected readonly sentPendingRequests = computed(() =>
    this.historyItems().filter(item => item.direction === 'sent' && item.status === 'pending')
  );
  protected readonly visiblePendingCount = computed(() =>
    this.sentPendingRequests().length
    + this.taskCreationRequests().length
    + this.taskEditRequests().length
    + this.allocationRequests().length
    + this.objectiveChangeRequests().length
    + this.objectiveInvitations().length
  );

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
        .subscribe((projectId) => {
          this.projectId.set(projectId);
          this.historyItems.set([]);
          this.historyError.set(null);
          if (!projectId) return;
          void this.loadModules();
          if (this.historyOpen()) void this.loadHistory();
        });
    } else {
      const projectId = this.route.snapshot?.paramMap?.get('id') ?? '';
      this.projectId.set(projectId);
      if (projectId) void this.loadModules();
    }
  }

  ngOnInit(): void {
    void this.store.loadAll();
    void this.loadHistory();
  }

  ngAfterViewInit(): void {
    this.toolbarStore.setTemplate(this.toolbarTpl());
  }

  ngOnDestroy(): void {
    this.toolbarStore.setTemplate(null);
  }

  activeErrorFor(item: ApprovalItem): string | null {
    if (this.lastFailedId === item.id) return this.store.error();
    return null;
  }

  async onApprove(item: ApprovalItem, override?: number | EditObjectiveRequestPayloadDto): Promise<void> {
    this.lastFailedId = null;
    const ok = await this.store.approve(item, override);
    if (!ok) this.lastFailedId = item.id;
  }

  async onReject(item: ApprovalItem, comment?: string): Promise<void> {
    this.lastFailedId = null;
    await this.store.reject(item, comment);
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
      await this.store.loadAll();
    } catch (err: any) {
      this.createError.set(err?.error?.detail || err?.error?.message || err?.message || 'Failed to create approval request.');
    } finally {
      this.creating.set(false);
    }
  }

  onRequestOwnAllocation(item: ApprovalItem): void {
    const objectiveId = item.kind === 'allocation_extend'
      ? (item.raw as AllocationRequestDto).objectiveId
      : undefined;
    this.openCreateApproval(objectiveId);
  }

  onViewTarget(item: ApprovalItem): void {
    if (item.targetType === 'task' && item.targetId) {
      this.selectedTaskId.set(item.targetId);
      return;
    }
    if (item.targetType === 'module' && item.targetId) {
      void this.router.navigate(['/work', this.projectId(), 'milestones', item.targetId, 'tree']);
    }
  }

  onTaskDetailsClosed(): void {
    this.selectedTaskId.set(null);
    void this.store.loadAll();
  }

  openHistory(): void {
    this.historyOpen.set(true);
    void this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;
    const loadVersion = ++this.historyLoadVersion;

    this.historyLoading.set(true);
    this.historyError.set(null);
    try {
      const items = await firstValueFrom(this.approvalsApi.getApprovalHistory(projectId));
      if (loadVersion === this.historyLoadVersion) this.historyItems.set(items);
    } catch (err: any) {
      if (loadVersion === this.historyLoadVersion) {
        this.historyError.set(
          err?.error?.detail || err?.error?.message || err?.message || 'Failed to load approval history.'
        );
      }
    } finally {
      if (loadVersion === this.historyLoadVersion) this.historyLoading.set(false);
    }
  }

  historyKindLabel(kind: string): string {
    const labels: Record<string, string> = {
      task_creation: 'Task creation',
      task_edit: 'Task edit',
      allocation_extend: 'Allocation request',
      objective_edit: 'Module edit',
      objective_change: 'Module change',
      objective_invitation: 'Module invitation'
    };
    return labels[kind] ?? 'Approval request';
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
