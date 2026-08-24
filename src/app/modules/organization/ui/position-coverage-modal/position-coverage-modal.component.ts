import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ActiveHolder,
  AddCoverageRecordRequest,
  ManagementCoverageRecordResponse,
  PositionListItemResponse,
  PositionTreeNodeResponse,
  UpdateCoverageRecordRequest
} from '../../models/position.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';

export interface UpdateCoverageEvent {
  coverageId: string;
  payload: UpdateCoverageRecordRequest;
}

export interface TargetOccupancyRequest {
  coveredTargetType: 'Position' | 'Department';
  coveredPositionId: string | null;
  coveredDepartmentId: string | null;
  excludingRecordId?: string;
}

@Component({
  selector: 'app-position-coverage-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, SelectComponent],
  templateUrl: './position-coverage-modal.component.html',
  styleUrl: './position-coverage-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionCoverageModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) position!: PositionListItemResponse | PositionTreeNodeResponse;
  @Input({ required: true }) coverageRecords: readonly ManagementCoverageRecordResponse[] = [];
  @Input({ required: true }) availablePositions: readonly { id: string; name: string }[] = [];
  @Input({ required: true }) availableDepartments: readonly { id: string; name: string }[] = [];
  @Input() loading = false;
  @Input() saving = false;
  @Input() error: string | null = null;
  @Input() canManage = false;
  /**
   * Active coverage for whichever target is currently selected in the add/edit form, across ALL
   * owner positions - fetched by the parent (keyed on targetOccupancyRequested) rather than
   * derived from coverageRecords, which only contains rules owned by THIS position and can't see
   * that e.g. a different position already claimed "Primary Manager" for the same target.
   */
  @Input() targetOccupancy: readonly ManagementCoverageRecordResponse[] = [];
  @Input() ownerHolders: readonly ActiveHolder[] = [];

  @Output() addCoverage = new EventEmitter<AddCoverageRecordRequest>();
  @Output() updateCoverage = new EventEmitter<UpdateCoverageEvent>();
  @Output() removeCoverage = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  /** Emitted whenever the selected/edited target changes so the parent can (re)fetch targetOccupancy. */
  @Output() targetOccupancyRequested = new EventEmitter<TargetOccupancyRequest>();

  readonly showAddForm = this.fb.control(false);

  readonly addForm = this.fb.group({
    coveredTargetType: ['Position' as 'Position' | 'Department', [Validators.required]],
    coveredPositionId: [''],
    coveredDepartmentId: [''],
    ownerOrder: [1, [Validators.required]],
    responsibleEmployeeId: ['']
  });

  /** Coverage record id currently showing its inline "Edit level" form, or null when none is. */
  readonly editingCoverageId = signal<string | null>(null);
  readonly editOwnerOrderValue = signal(1);

  /**
   * Set when a submit is in flight, cleared once the resulting saving:true->false transition is
   * handled. addCoverage/updateCoverage are fire-and-forget Outputs - the component has no direct
   * way to know if the parent's save actually succeeded, so it watches the `saving` Input instead:
   * only close/reset the form once saving finishes WITHOUT an error. On failure the form (and the
   * user's selections) stay exactly as they were, right next to the error message that explains
   * why - instead of being wiped and reopened blank while a stale error banner lingers with no
   * visible connection to anything on screen.
   */
  private pendingSubmit: 'add' | 'edit' | null = null;

  /**
   * targetOccupancy arrives asynchronously (parent fetch), after the resetOwnerOrderToFirstAvailable
   * call already made at selection time ran against the previous target's data. Once the real
   * result lands, re-clamp the selected order in case it turned out to already be occupied by
   * another owner. Also watches `saving` to resolve a pending submit (see pendingSubmit above).
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetOccupancy']) {
      if (this.showAddForm.value) {
        this.resetOwnerOrderToFirstAvailable();
      }
      const editingId = this.editingCoverageId();
      if (editingId) {
        const record = this.coverageRecords.find((r) => r.id === editingId);
        if (record) {
          const options = this.editOwnerOrderOptions(record);
          const currentValue = String(this.editOwnerOrderValue());
          const currentOption = options.find((o) => o.value === currentValue);
          if (!currentOption || currentOption.disabled) {
            const firstEnabled = options.find((o) => !o.disabled);
            if (firstEnabled) this.editOwnerOrderValue.set(+firstEnabled.value);
          }
        }
      }
    }

    const savingChange = changes['saving'];
    if (savingChange && savingChange.previousValue === true && savingChange.currentValue === false && this.pendingSubmit) {
      const kind = this.pendingSubmit;
      this.pendingSubmit = null;
      if (!this.error) {
        if (kind === 'add') {
          this.addForm.reset({
            coveredTargetType: 'Position',
            coveredPositionId: '',
            coveredDepartmentId: '',
            ownerOrder: 1,
            responsibleEmployeeId: ''
          });
          this.showAddForm.setValue(false);
          this.extraLevelsRequested.set(0);
        } else {
          this.editingCoverageId.set(null);
        }
      }
      // On failure: leave the form/edit row open with the user's selections intact, right next
      // to the error message - resetOwnerOrderToFirstAvailable already ran via the targetOccupancy
      // change that normally accompanies a conflict, so the now-disabled level is visible too.
    }
  }

  formatResponsibilityLabel(ownerOrder: number, isOccupied = false): string {
    const baseLabel = ownerOrder === 1 ? 'Primary Manager' : `Backup Manager ${ownerOrder - 1}`;
    return isOccupied ? `${baseLabel} — already assigned` : baseLabel;
  }

  readonly activeTab = signal<'all' | 'automatic' | 'manual'>('all');

  get filteredRecords(): readonly ManagementCoverageRecordResponse[] {
    const tab = this.activeTab();
    if (tab === 'automatic') return this.automaticRecords;
    if (tab === 'manual') return this.manualRecords;
    return this.coverageRecords;
  }

  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'P';
  }

  /** Read-only, system-generated coverage from the position reporting line - cannot be edited or removed. */
  get automaticRecords(): readonly ManagementCoverageRecordResponse[] {
    return this.coverageRecords.filter((record) => record.isLocked);
  }

  /** Manually-added coverage rules - editable and removable, unless they turn out to be legacy self-coverage. */
  get manualRecords(): readonly ManagementCoverageRecordResponse[] {
    return this.coverageRecords.filter((record) => !record.isLocked);
  }

  /**
   * True when a manual record's covered target is this same owner position. New self-coverage can
   * never be created (positionOptions excludes the owner), but older data may still contain it -
   * such rows are shown read-only with a warning instead of Edit/Remove actions.
   */
  isSelfCoverage(record: ManagementCoverageRecordResponse): boolean {
    return record.coveredTargetType === 'Position' && record.coveredPositionId === this.position.id;
  }

  targetName(record: ManagementCoverageRecordResponse): string {
    return record.coveredTargetType === 'Department'
      ? record.coveredDepartmentName || 'Department'
      : record.coveredPositionName || 'Position';
  }

  /**
   * Responsibility-level options for a given covered target, built from targetOccupancy - the
   * parent-fetched, global (all-owners) active coverage for whichever target is currently
   * selected/edited. Using targetOccupancy rather than coverageRecords (this owner's own rules
   * only) is what lets a *different* position see that e.g. Primary Manager is already claimed by
   * someone else for the same department, instead of only finding out via a 409 on submit.
   * Occupied levels are included as disabled options labeled "— already assigned". Unclaimed
   * levels extend dynamically up to max(1 + minimumBackupLevels + extraLevelsRequested(),
   * highestUsedOrder + 1); extraLevelsRequested grows via "+ Add another level" so there's no
   * hard ceiling on how many backups a target can have.
   */
  private usedOrdersForTarget(
    type: 'Position' | 'Department',
    positionId: string | null,
    departmentId: string | null,
    excludeRecordId?: string
  ): number[] {
    return this.targetOccupancy
      .filter((record) => {
        if (record.id === excludeRecordId) return false;
        if (record.status !== 'active' || record.coveredTargetType !== type) return false;
        return type === 'Position'
          ? !!positionId && record.coveredPositionId === positionId
          : !!departmentId && record.coveredDepartmentId === departmentId;
      })
      .map((record) => record.ownerOrder);
  }

  /** Extra backup levels the user has explicitly asked to see beyond the default minimum, via
   * "+ Add another level". Reset whenever the selected/edited target changes. */
  readonly extraLevelsRequested = signal(0);

  addAnotherLevel(): void {
    this.extraLevelsRequested.update((v) => v + 1);
  }

  private ownerOrderOptionsFor(usedOrders: readonly number[], minimumBackupLevels = 3): readonly SelectOption[] {
    const highestUsed = usedOrders.length > 0 ? Math.max(...usedOrders) : 0;
    const maxOrder = Math.max(1 + minimumBackupLevels + this.extraLevelsRequested(), highestUsed + 1);
    const options: SelectOption[] = [];
    for (let order = 1; order <= maxOrder; order++) {
      const isOccupied = usedOrders.includes(order);
      options.push({
        value: String(order),
        label: this.formatResponsibilityLabel(order, isOccupied),
        disabled: isOccupied
      });
    }
    return options;
  }

  get ownerOrderOptions(): readonly SelectOption[] {
    return this.ownerOrderOptionsFor(this.usedOrdersForSelectedTarget());
  }

  private usedOrdersForSelectedTarget(): number[] {
    const type = this.addForm.controls.coveredTargetType.value ?? 'Position';
    const positionId = this.addForm.controls.coveredPositionId.value;
    const departmentId = this.addForm.controls.coveredDepartmentId.value;

    return this.usedOrdersForTarget(type, positionId || null, departmentId || null);
  }

  /** Friendly helper text hints for occupied levels of the currently selected target. */
  get occupiedLevelHints(): readonly string[] {
    const usedOrders = this.usedOrdersForSelectedTarget();
    return usedOrders
      .slice()
      .sort((a, b) => a - b)
      .map((order) => {
        if (order === 1) return 'Primary Manager is already assigned.';
        return `Backup Manager ${order - 1} is already assigned.`;
      });
  }

  /** Options for the inline edit form of an existing manual record; keeps its own current order enabled. */
  editOwnerOrderOptions(record: ManagementCoverageRecordResponse): readonly SelectOption[] {
    const usedOrders = this.usedOrdersForTarget(
      record.coveredTargetType,
      record.coveredPositionId,
      record.coveredDepartmentId,
      record.id
    );
    return this.ownerOrderOptionsFor(usedOrders);
  }

  /** Friendly helper text hints for occupied levels when editing a record (excluding own record). */
  editOccupiedLevelHints(record: ManagementCoverageRecordResponse): readonly string[] {
    const usedOrders = this.usedOrdersForTarget(
      record.coveredTargetType,
      record.coveredPositionId,
      record.coveredDepartmentId,
      record.id
    );
    return usedOrders
      .slice()
      .sort((a, b) => a - b)
      .map((order) => {
        if (order === 1) return 'Primary Manager is already assigned.';
        return `Backup Manager ${order - 1} is already assigned.`;
      });
  }

  private resetOwnerOrderToFirstAvailable(): void {
    const options = this.ownerOrderOptions;
    const currentValue = this.addForm.controls.ownerOrder.value?.toString() ?? '';
    const currentOption = options.find((option) => option.value === currentValue);
    if (!currentOption || currentOption.disabled) {
      const firstEnabled = options.find((option) => !option.disabled);
      if (firstEnabled) {
        this.addForm.controls.ownerOrder.setValue(+firstEnabled.value);
      }
    }
  }

  get positionOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'Select Position *' }
    ];
    for (const p of this.availablePositions) {
      if (p.id !== this.position.id) {
        opts.push({ value: p.id, label: p.name });
      }
    }
    return opts;
  }

  get departmentOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'Select Department *' }
    ];
    for (const d of this.availableDepartments) {
      opts.push({ value: d.id, label: d.name });
    }
    return opts;
  }

  toggleAddForm(): void {
    const nextVal = !this.showAddForm.value;
    this.showAddForm.setValue(nextVal);
    if (nextVal) {
      this.extraLevelsRequested.set(0);
      this.resetOwnerOrderToFirstAvailable();
    }
  }

  onTargetTypeChange(type: 'Position' | 'Department'): void {
    this.addForm.controls.coveredTargetType.setValue(type);
    this.addForm.controls.coveredPositionId.setValue('');
    this.addForm.controls.coveredDepartmentId.setValue('');
    this.extraLevelsRequested.set(0);
    this.resetOwnerOrderToFirstAvailable();
  }

  onCoveredPositionChange(positionId: string): void {
    this.addForm.controls.coveredPositionId.setValue(positionId);
    this.extraLevelsRequested.set(0);
    this.targetOccupancyRequested.emit({ coveredTargetType: 'Position', coveredPositionId: positionId || null, coveredDepartmentId: null });
    this.resetOwnerOrderToFirstAvailable();
  }

  onCoveredDepartmentChange(departmentId: string): void {
    this.addForm.controls.coveredDepartmentId.setValue(departmentId);
    this.extraLevelsRequested.set(0);
    this.targetOccupancyRequested.emit({ coveredTargetType: 'Department', coveredPositionId: null, coveredDepartmentId: departmentId || null });
    this.resetOwnerOrderToFirstAvailable();
  }

  onAddSubmit(): void {
    const type = this.addForm.controls.coveredTargetType.value;
    const posId = this.addForm.controls.coveredPositionId.value;
    const deptId = this.addForm.controls.coveredDepartmentId.value;
    const ownerOrder = Number(this.addForm.controls.ownerOrder.value) || 1;

    if (type === 'Position' && !posId) {
      this.addForm.controls.coveredPositionId.markAsTouched();
      return;
    }
    if (type === 'Department' && !deptId) {
      this.addForm.controls.coveredDepartmentId.markAsTouched();
      return;
    }

    if (this.needsResponsiblePersonPick && !this.addForm.controls.responsibleEmployeeId.value) {
      this.addForm.controls.responsibleEmployeeId.markAsTouched();
      return;
    }

    const usedOrders = this.usedOrdersForSelectedTarget();
    if (usedOrders.includes(ownerOrder)) {
      return;
    }

    // Don't reset/close here - addCoverage is fire-and-forget, so this component doesn't yet know
    // whether the save will actually succeed. ngOnChanges resolves it once `saving` flips back to
    // false: closes+resets on success, leaves the form (and this exact selection) open on failure
    // so the error and the now-disabled level are visible side by side.
    this.pendingSubmit = 'add';
    this.addCoverage.emit({
      coveredTargetType: type === 'Department' ? 'Department' : 'Position',
      coveredPositionId: type === 'Position' ? posId : null,
      coveredDepartmentId: type === 'Department' ? deptId : null,
      ownerOrder,
      responsibleEmployeeId: this.needsResponsiblePersonPick ? this.addForm.controls.responsibleEmployeeId.value : null
    });
  }

  startEdit(record: ManagementCoverageRecordResponse): void {
    this.editingCoverageId.set(record.id);
    this.editOwnerOrderValue.set(record.ownerOrder);
    this.extraLevelsRequested.set(0);
    this.targetOccupancyRequested.emit({
      coveredTargetType: record.coveredTargetType as 'Position' | 'Department',
      coveredPositionId: record.coveredPositionId,
      coveredDepartmentId: record.coveredDepartmentId,
      excludingRecordId: record.id
    });
  }

  cancelEdit(): void {
    this.editingCoverageId.set(null);
  }

  onEditOwnerOrderChange(value: string): void {
    this.editOwnerOrderValue.set(+(value || 1));
  }

  saveEdit(record: ManagementCoverageRecordResponse): void {
    const newOrder = this.editOwnerOrderValue();
    const usedOrders = this.usedOrdersForTarget(
      record.coveredTargetType,
      record.coveredPositionId,
      record.coveredDepartmentId,
      record.id
    );
    if (usedOrders.includes(newOrder)) {
      return;
    }

    // See onAddSubmit: don't close the edit row here - wait for the saving:true->false
    // transition in ngOnChanges so a failed save leaves the row (and the error) visible together.
    this.pendingSubmit = 'edit';
    this.updateCoverage.emit({ coverageId: record.id, payload: { ownerOrder: newOrder } });
  }

  get needsResponsiblePersonPick(): boolean {
    return this.ownerHolders.length > 1;
  }

  get responsiblePersonOptions(): readonly SelectOption[] {
    return this.ownerHolders.map(h => ({
      value: h.employeeId,
      label: `${h.firstName} ${h.lastName}`
    }));
  }

  onResponsiblePersonChange(employeeId: string): void {
    this.addForm.controls.responsibleEmployeeId.setValue(employeeId);
  }

  isAmbiguousOwner(record: ManagementCoverageRecordResponse): boolean {
    return !record.responsibleEmployeeName && this.ownerHolders.length > 1 && record.ownerPositionId === this.position.id;
  }

  onDelete(cov: ManagementCoverageRecordResponse): void {
    if (cov.isLocked) return;
    this.removeCoverage.emit(cov.id);
  }
}
