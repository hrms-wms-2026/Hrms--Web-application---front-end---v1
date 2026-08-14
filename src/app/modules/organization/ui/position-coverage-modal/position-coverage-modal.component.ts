import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
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

@Component({
  selector: 'app-position-coverage-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, SelectComponent],
  templateUrl: './position-coverage-modal.component.html',
  styleUrl: './position-coverage-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionCoverageModalComponent {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) position!: PositionListItemResponse | PositionTreeNodeResponse;
  @Input({ required: true }) coverageRecords: readonly ManagementCoverageRecordResponse[] = [];
  @Input({ required: true }) availablePositions: readonly { id: string; name: string }[] = [];
  @Input({ required: true }) availableDepartments: readonly { id: string; name: string }[] = [];
  @Input() loading = false;
  @Input() saving = false;
  @Input() error: string | null = null;
  @Input() canManage = false;

  @Output() addCoverage = new EventEmitter<AddCoverageRecordRequest>();
  @Output() updateCoverage = new EventEmitter<UpdateCoverageEvent>();
  @Output() removeCoverage = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  readonly showAddForm = this.fb.control(false);

  readonly addForm = this.fb.group({
    coveredTargetType: ['Position' as 'Position' | 'Department', [Validators.required]],
    coveredPositionId: [''],
    coveredDepartmentId: [''],
    ownerOrder: [1, [Validators.required]]
  });

  /** Coverage record id currently showing its inline "Edit level" form, or null when none is. */
  readonly editingCoverageId = signal<string | null>(null);
  readonly editOwnerOrderValue = signal(1);

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
   * Responsibility-level options for a given covered target, built from the coverage records
   * already loaded for this owner rather than a fixed list. Occupied levels for that target are
   * included as disabled options clearly labeled "— already assigned". Unclaimed levels are offered,
   * extending dynamically up to max(1 + minimumBackupLevels, highestUsedOrder + 1) so Backup N
   * beyond 1/2/3 remains accessible.
   */
  private usedOrdersForTarget(
    type: 'Position' | 'Department',
    positionId: string | null,
    departmentId: string | null,
    excludeRecordId?: string
  ): number[] {
    return this.coverageRecords
      .filter((record) => {
        if (record.id === excludeRecordId) return false;
        if (record.status !== 'active' || record.coveredTargetType !== type) return false;
        return type === 'Position'
          ? !!positionId && record.coveredPositionId === positionId
          : !!departmentId && record.coveredDepartmentId === departmentId;
      })
      .map((record) => record.ownerOrder);
  }

  private ownerOrderOptionsFor(usedOrders: readonly number[], minimumBackupLevels = 3): readonly SelectOption[] {
    const highestUsed = usedOrders.length > 0 ? Math.max(...usedOrders) : 0;
    const maxOrder = Math.max(1 + minimumBackupLevels, highestUsed + 1);
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
      this.resetOwnerOrderToFirstAvailable();
    }
  }

  onTargetTypeChange(type: 'Position' | 'Department'): void {
    this.addForm.controls.coveredTargetType.setValue(type);
    this.addForm.controls.coveredPositionId.setValue('');
    this.addForm.controls.coveredDepartmentId.setValue('');
    this.resetOwnerOrderToFirstAvailable();
  }

  onCoveredPositionChange(positionId: string): void {
    this.addForm.controls.coveredPositionId.setValue(positionId);
    this.resetOwnerOrderToFirstAvailable();
  }

  onCoveredDepartmentChange(departmentId: string): void {
    this.addForm.controls.coveredDepartmentId.setValue(departmentId);
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

    const usedOrders = this.usedOrdersForSelectedTarget();
    if (usedOrders.includes(ownerOrder)) {
      return;
    }

    this.addCoverage.emit({
      coveredTargetType: type === 'Department' ? 'Department' : 'Position',
      coveredPositionId: type === 'Position' ? posId : null,
      coveredDepartmentId: type === 'Department' ? deptId : null,
      ownerOrder
    });

    this.addForm.reset({
      coveredTargetType: 'Position',
      coveredPositionId: '',
      coveredDepartmentId: '',
      ownerOrder: 1
    });
    this.showAddForm.setValue(false);
  }

  startEdit(record: ManagementCoverageRecordResponse): void {
    this.editingCoverageId.set(record.id);
    this.editOwnerOrderValue.set(record.ownerOrder);
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

    this.updateCoverage.emit({ coverageId: record.id, payload: { ownerOrder: newOrder } });
    this.editingCoverageId.set(null);
  }

  onDelete(cov: ManagementCoverageRecordResponse): void {
    if (cov.isLocked) return;
    this.removeCoverage.emit(cov.id);
  }
}
