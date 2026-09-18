import { AfterViewInit, Component, inject, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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

@Component({
  selector: 'app-work-approvals',
  standalone: true,
  imports: [ApprovalRequestRowComponent, ModalComponent, InputComponent, WorkDropdownComponent, ButtonComponent],
  template: `
    <ng-template #toolbarTpl>
      <app-button data-testid="create-approval-button" variant="primary" (pressed)="openCreateApproval()">
        Create Approval
      </app-button>
    </ng-template>

    @if (store.loading()) {
      <p>Loading approvals…</p>
    } @else if (store.error() && store.pendingCount() === 0) {
      <p class="work-approvals__error">{{ store.error() }}</p>
    } @else {
      <div class="work-approvals">
        <div class="work-approvals__toolbar">
          <h1>Approvals</h1>
        </div>

        @if (store.taskCreationRequests().length > 0) {
        <section>
          <h2>Task Creation Requests <span>{{ store.taskCreationRequests().length }}</span></h2>
          @for (item of store.taskCreationRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
            />
          }
        </section>
        }

        @if (store.allocationRequests().length > 0) {
        <section>
          <h2>Allocation Requests <span>{{ store.allocationRequests().length }}</span></h2>
          @for (item of store.allocationRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              [inlineError]="activeErrorFor(item)"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
              (requestOwnAllocation)="onRequestOwnAllocation(item)"
            />
          }
        </section>
        }

        @if (store.objectiveChangeRequests().length > 0) {
        <section>
          <h2>Objective Change Requests <span>{{ store.objectiveChangeRequests().length }}</span></h2>
          @for (item of store.objectiveChangeRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
            />
          }
        </section>
        }

        @if (store.objectiveInvitations().length > 0) {
        <section>
          <h2>Objective Invitations <span>{{ store.objectiveInvitations().length }}</span></h2>
          @for (item of store.objectiveInvitations(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item, $event)"
              (rejected)="onReject(item, $event)"
            />
          }
        </section>
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
  `,
  styles: [`
    .work-approvals { display: flex; flex-direction: column; gap: 18px; width: min(100%, 1180px); margin: 0 auto; padding: 8px 20px 28px; }
    .work-approvals__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 4px; border-bottom: 1px solid var(--color-border); }
    .work-approvals h1, .work-approvals h2 { margin: 0; color: var(--color-text-primary); }
    .work-approvals h1 { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
    .work-approvals h2 { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 650; }
    .work-approvals h2 span { display: inline-flex; min-width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 650; }
    .work-approvals section { display: flex; flex-direction: column; gap: 10px; }
    @media (max-width: 680px) { .work-approvals { padding-inline: 12px; } .work-approvals__toolbar { align-items: flex-start; flex-direction: column; } }
    .work-approvals__error { color: var(--color-danger); }
    .work-approvals__form { display: flex; flex-direction: column; gap: 14px; }
    .work-approvals__form-actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class WorkApprovalsComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly store = inject(WorkApprovalsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly approvalsApi = inject(WorkApprovalsApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');
  private readonly projectId = this.resolveProjectId();
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

  ngOnInit(): void {
    void this.store.loadAll();
    void this.loadModules();
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

  private resolveProjectId(): string {
    return this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.parent?.snapshot.paramMap.get('id')
      ?? '';
  }

  private async loadModules(): Promise<void> {
    if (!this.projectId) return;
    try {
      const modules = await firstValueFrom(this.projectApi.getMyMilestones(this.projectId));
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
