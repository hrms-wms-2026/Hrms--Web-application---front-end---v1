import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
import { PersonPickerDialogComponent, PersonPickerOption } from '../../../../shared/ui/person-picker-dialog/person-picker-dialog.component';
import { AssetUploadListComponent, AssetRowView } from '../asset-upload-list/asset-upload-list.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { ObjectiveDetail } from '../../models/milestone.model';
import { CreateObjectiveRequestDto, EditObjectiveRequestDto } from '../../models/dto/milestone.dto';
import { MonitorWarningDto } from '../../models/dto/monitor.dto';
import { ProjectMonitorApiService } from '../../data-access/project-monitor-api.service';
import { MonitorWarningCalloutComponent } from '../monitor-warning-callout/monitor-warning-callout.component';

/** How long the form waits after the last change before asking the monitor for warnings. */
export const MONITOR_CHECK_DEBOUNCE_MS = 400;

interface SelectedMember {
  employeeId: string;
  isOwner: boolean;
}

@Component({
  selector: 'app-sub-module-form',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, DateRangePickerComponent, PersonPickerDialogComponent, AssetUploadListComponent, MonitorWarningCalloutComponent],
  template: `
    <app-modal [open]="open()" [title]="mode() === 'edit' ? 'Milestone settings' : 'Create sub Milestone'" size="lg" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="title-field">
          <app-input label="Title" [value]="title()" [error]="errors()['title']" (valueChange)="title.set($event)" />
        </span>
        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>
        <span data-testid="date-range-field">
          <app-date-range-picker [from]="startDate()" [to]="endDate()" (rangeChange)="onRangeChange($event)" />
          @if (errors()['startDate'] || errors()['endDate']) {
            <p class="text-xs text-[var(--color-danger-text)]">{{ errors()['startDate'] || errors()['endDate'] }}</p>
          }
        </span>
        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours']" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        @if (mode() === 'edit') {
          <span data-testid="achieved-field" class="flex items-center gap-2">
            <input type="checkbox" id="sub-module-achieved-toggle" [checked]="achieved()" [disabled]="isDefault()" (change)="onAchievedChange($event)" />
            <label for="sub-module-achieved-toggle" class="text-sm text-[var(--color-text-primary)]">Achieved</label>
            @if (isDefault()) {
              <span class="text-xs text-[var(--color-text-secondary)]">(Achieve the project instead — the Default Milestone follows the project's own achieved state)</span>
            }
          </span>
        }

        @if (mode() === 'create') {
          <div data-testid="members-section" class="flex flex-col gap-2">
            <span class="text-xs font-semibold text-[var(--color-text-primary)]">Members</span>
            <span data-testid="add-member-button">
              <app-button variant="secondary" size="sm" (pressed)="memberPickerOpen.set(true)">+ Add member</app-button>
            </span>
            @for (member of members(); track member.employeeId) {
              <div data-testid="member-row" [attr.data-employee-id]="member.employeeId" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2">
                <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ directory.get(member.employeeId)?.name ?? 'Unknown employee' }}</span>
                <div class="flex items-center gap-1">
                  @if (member.isOwner) {
                    <span data-testid="owner-badge" class="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">Owner invite pending</span>
                  } @else {
                    <span role="presentation" data-testid="make-owner-button" (click)="onSetOwner(member.employeeId)">
                      <app-button variant="secondary" size="sm">Invite as owner</app-button>
                    </span>
                  }
                  <span role="presentation" data-testid="remove-member-button" (click)="onMemberRemove(member.employeeId)">
                    <app-button variant="secondary" size="sm">Remove</app-button>
                  </span>
                </div>
              </div>
            }
          </div>
          <app-person-picker-dialog [open]="memberPickerOpen()" title="Add members" [disabledPeople]="pickedMembers()"
            (confirmed)="onMembersPicked($event)" (closed)="memberPickerOpen.set(false)" />
        }

        <div data-testid="assets-section" class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-[var(--color-text-primary)]">Assets</span>
          <app-asset-upload-list
            [rows]="assetRows()"
            [disabled]="submitting()"
            (filesPicked)="onAssetFilesPicked($event)"
            (removeRequested)="onAssetRemove($event)"
            (retryRequested)="onAssetRetry($event)"
          />
        </div>

        <app-monitor-warning-callout [warnings]="capacityWarnings()" />

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="sub-module-form__actions mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
              {{ mode() === 'edit' ? 'Save changes' : 'Create' }}
            </app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .sub-module-form__actions ::ng-deep app-button > button {
      width: auto;
      height: 30px;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
  `]
})
export class SubModuleFormComponent {
  private readonly store = inject(ProjectDetailStore);
  private readonly monitorApi = inject(ProjectMonitorApiService);
  protected readonly directory = inject(EmployeeDirectoryStore);

  mode = input<'create' | 'edit'>('create');
  open = input(false);
  parentObjectiveId = input('');
  /** Enables the live capacity check (advisory only - it never blocks saving). */
  projectId = input('');
  initialValue = input<ObjectiveDetail | null>(null);
  submitting = input(false);
  errorMessage = input('');

  created = output<{ payload: CreateObjectiveRequestDto; assetFiles: readonly File[] }>();
  saved = output<{ fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  startDate = signal('');
  endDate = signal('');
  allocatedHours = signal(0);
  achieved = signal(false);
  isDefault = signal(false);
  errors = signal<Record<string, string>>({});

  members = signal<SelectedMember[]>([]);
  memberPickerOpen = signal(false);

  assetRows = signal<AssetRowView[]>([]);
  private pendingFiles = new Map<string, File>();
  private nextLocalId = 0;
  // Ids of already-uploaded assets whose delete call failed server-side and is
  // now showing as an error row. Tracked separately from pendingFiles (which
  // only ever holds local upload files) so onAssetRemove/onAssetRetry can tell
  // a failed-delete row apart from a failed-upload row and dispatch the right
  // retry action instead of silently dropping the row.
  private failedDeleteIds = new Set<string>();

  /** Project monitor warnings for the current dates/hours/members, e.g. "more hours than the team can produce". */
  readonly capacityWarnings = signal<readonly MonitorWarningDto[]>([]);
  private capacityCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private capacityCheckVersion = 0;

  constructor() {
    effect(() => {
      this.open();
      const value = this.initialValue();
      if (this.mode() === 'edit' && value) {
        this.title.set(value.title);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.endDate.set(value.endDate);
        this.allocatedHours.set(value.allocatedHours);
        this.achieved.set(value.isAchieved ?? false);
        this.isDefault.set(value.isDefault);
        this.assetRows.set((value.assets ?? []).map((a) => ({ id: a.id, fileName: a.fileName, sizeBytes: a.sizeBytes, status: 'uploaded' as const })));
      } else if (this.mode() === 'create') {
        this.title.set('');
        this.description.set('');
        this.startDate.set('');
        this.endDate.set('');
        this.allocatedHours.set(0);
        this.achieved.set(false);
        this.isDefault.set(false);
        this.assetRows.set([]);
        this.members.set([]);
      }
      this.pendingFiles.clear();
      this.failedDeleteIds.clear();
      this.errors.set({});
    });

    // Live capacity check: re-run (debounced) whenever the planning inputs change.
    effect(() => {
      const projectId = this.projectId();
      const request = {
        moduleId: this.mode() === 'edit' ? this.initialValue()?.id ?? null : null,
        startDate: this.startDate(),
        endDate: this.endDate(),
        allocatedHours: this.allocatedHours(),
        memberEmployeeIds: this.members().map((member) => member.employeeId)
      };
      const open = this.open();
      untracked(() => this.scheduleCapacityCheck(open ? projectId : '', request));
    });
    inject(DestroyRef).onDestroy(() => this.clearCapacityTimer());
  }

  private scheduleCapacityCheck(projectId: string, request: {
    moduleId: string | null; startDate: string; endDate: string; allocatedHours: number; memberEmployeeIds: string[];
  }): void {
    this.clearCapacityTimer();
    const version = ++this.capacityCheckVersion;
    if (!projectId || !request.startDate || !request.endDate || request.endDate < request.startDate || !(request.allocatedHours > 0)) {
      this.capacityWarnings.set([]);
      return;
    }
    this.capacityCheckTimer = setTimeout(async () => {
      try {
        const result = await firstValueFrom(this.monitorApi.checkModule(projectId, request));
        if (version === this.capacityCheckVersion) this.capacityWarnings.set(result.warnings ?? []);
      } catch {
        // Advisory only: if the check fails, just show no warning.
        if (version === this.capacityCheckVersion) this.capacityWarnings.set([]);
      }
    }, MONITOR_CHECK_DEBOUNCE_MS);
  }

  private clearCapacityTimer(): void {
    if (this.capacityCheckTimer !== null) clearTimeout(this.capacityCheckTimer);
    this.capacityCheckTimer = null;
  }

  allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
  }

  onAchievedChange(event: Event): void {
    this.achieved.set((event.target as HTMLInputElement).checked);
  }

  onRangeChange(range: { from: string; to: string }): void {
    this.startDate.set(range.from);
    this.endDate.set(range.to);
  }

  /** Members already picked: listed as added in the picker. */
  protected readonly pickedMembers = computed<PersonPickerOption[]>(() =>
    this.members().map((m) => ({ id: m.employeeId, name: this.directory.get(m.employeeId)?.name ?? 'Employee' })));

  onMembersPicked(employeeIds: string[]): void {
    this.memberPickerOpen.set(false);
    const fresh = employeeIds.filter((id) => !this.members().some((m) => m.employeeId === id));
    if (fresh.length === 0) return;
    this.members.update((list) => [...list, ...fresh.map((employeeId) => ({ employeeId, isOwner: false }))]);
    void this.directory.ensureLoaded(fresh);
  }

  onMemberRemove(employeeId: string): void {
    this.members.update((list) => list.filter((m) => m.employeeId !== employeeId));
  }

  onSetOwner(employeeId: string): void {
    // Sets headEmployeeId on submit, which the backend treats as a pending leader
    // invitation, not immediate headship (CreateObjectiveCommandHandler) — the
    // creator stays head until that invite is accepted.
    this.members.update((list) => list.map((m) => ({ ...m, isOwner: m.employeeId === employeeId })));
  }

  onAssetFilesPicked(files: File[]): void {
    for (const file of files) {
      const id = `local-${this.nextLocalId++}`;
      this.pendingFiles.set(id, file);
      if (this.mode() === 'edit') {
        this.assetRows.update((rows) => [...rows, { id, fileName: file.name, sizeBytes: file.size, status: 'uploading' }]);
        void this.uploadEditModeAsset(id, file);
      } else {
        this.assetRows.update((rows) => [...rows, { id, fileName: file.name, sizeBytes: file.size, status: 'staged' }]);
      }
    }
  }

  onAssetRetry(id: string): void {
    if (this.failedDeleteIds.has(id)) {
      // This error row came from a failed delete, not a failed upload - the
      // shared Retry button (rendered by AssetUploadListComponent for any
      // status === 'error' row) needs to re-attempt the delete, not an upload
      // pendingFiles has no entry for.
      this.onAssetRemove(id);
      return;
    }
    const file = this.pendingFiles.get(id);
    if (!file) return;
    this.assetRows.update((rows) => rows.map((row) => (row.id === id ? { ...row, status: 'uploading' as const, errorMessage: undefined } : row)));
    void this.uploadEditModeAsset(id, file);
  }

  onAssetRemove(id: string): void {
    const objectiveId = this.initialValue()?.id;
    const row = this.assetRows().find((r) => r.id === id);
    const isDeleteRetry = this.failedDeleteIds.has(id);

    if (this.mode() === 'edit' && objectiveId && row && (row.status === 'uploaded' || isDeleteRetry)) {
      this.failedDeleteIds.delete(id);
      this.pendingFiles.delete(id);
      this.assetRows.update((rows) => rows.filter((r) => r.id !== id));
      void this.deleteEditModeAsset(objectiveId, id, row);
      return;
    }

    this.failedDeleteIds.delete(id);
    this.pendingFiles.delete(id);
    this.assetRows.update((rows) => rows.filter((r) => r.id !== id));
  }

  private async deleteEditModeAsset(objectiveId: string, id: string, row: AssetRowView): Promise<void> {
    const result = await this.store.deleteMilestoneAsset(objectiveId, id);
    if (!result.success) {
      // Deletion failed server-side — put the row back and mark it as a
      // pending delete-retry (rather than a pending upload-retry) so the
      // next Remove or Retry click on this row re-attempts the delete
      // instead of just filtering the row out of the local list while it
      // stays attached server-side. The store already ran extractError, so
      // its milestoneActionError carries the real server detail.
      const message = this.store.milestoneActionError() ?? 'Failed to remove file. Click Remove to try again.';
      this.failedDeleteIds.add(id);
      this.assetRows.update((rows) => [...rows, { ...row, status: 'error' as const, errorMessage: message }]);
    }
  }

  private async uploadEditModeAsset(localId: string, file: File): Promise<void> {
    const objectiveId = this.initialValue()?.id;
    if (!objectiveId) return;
    const result = await this.store.uploadMilestoneAsset(objectiveId, file);
    if (result.success && result.asset) {
      this.pendingFiles.delete(localId);
      const asset = result.asset;
      this.assetRows.update((rows) => rows.map((row) =>
        row.id === localId ? { id: asset.id, fileName: asset.fileName, sizeBytes: asset.sizeBytes, status: 'uploaded' as const } : row));
    } else {
      const message = this.store.milestoneActionError() ?? 'Upload failed.';
      this.assetRows.update((rows) => rows.map((row) =>
        row.id === localId ? { ...row, status: 'error' as const, errorMessage: message } : row));
    }
  }

  submit(): void {
    const errors: Record<string, string> = {};
    if (!this.title().trim()) errors['title'] = 'Title is required.';
    if (!this.startDate()) errors['startDate'] = 'Start date is required.';
    if (!this.endDate()) errors['endDate'] = 'End date is required.';
    else if (this.startDate() && this.endDate() < this.startDate()) errors['endDate'] = 'End date cannot be before the start date.';
    if (this.allocatedHours() < 0) errors['allocatedHours'] = 'Allocated hours cannot be negative.';

    this.errors.set(errors);
    if (Object.keys(errors).length > 0) return;

    if (this.mode() === 'create') {
      const owner = this.members().find((m) => m.isOwner);
      const others = this.members().filter((m) => !m.isOwner);
      const assetFiles = this.assetRows()
        .filter((row) => row.status === 'staged')
        .map((row) => this.pendingFiles.get(row.id))
        .filter((file): file is File => file !== undefined);

      this.created.emit({
        payload: {
          parentObjectiveId: this.parentObjectiveId(),
          title: this.title(),
          description: this.description() || null,
          startDate: this.startDate(),
          endDate: this.endDate(),
          allocatedHours: this.allocatedHours(),
          headEmployeeId: owner ? owner.employeeId : null,
          memberInvitations: others.map((m) => ({ employeeId: m.employeeId, type: 'member' as const }))
        },
        assetFiles
      });
      return;
    }

    const initial = this.initialValue();
    this.saved.emit({
      fields: {
        title: this.title(),
        description: this.description(),
        startDate: this.startDate(),
        endDate: this.endDate(),
        allocatedHours: this.allocatedHours()
      },
      achievedChanged: initial !== null && this.achieved() !== (initial?.isAchieved ?? false),
      achieved: this.achieved()
    });
  }
}
