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
import { SelectComponent } from '../../../../shared/ui/select/select.component';

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

  formatResponsibilityLabel(ownerOrder: number): string {
    if (ownerOrder === 1) return 'Primary Manager';
    return `Backup Manager ${ownerOrder - 1}`;
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
   * already loaded for this owner rather than a fixed 1/2/3 list. Order values already claimed for
   * that exact target are excluded so the same level cannot be picked twice; the next unclaimed
   * order is always offered so backups beyond the historical Primary/Backup 1/Backup 2 trio remain
   * reachable. excludeRecordId lets the edit flow keep offering a record's own current order.
   * Duplicate submissions from a different owner position are still caught authoritatively by the
   * backend's 409.
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

  private ownerOrderOptionsFor(usedOrders: readonly number[], floor = 0): readonly { value: string; label: string }[] {
    const maxUsed = usedOrders.length > 0 ? Math.max(...usedOrders, floor) : floor;
    const options: { value: string; label: string }[] = [];
    for (let order = 1; order <= maxUsed + 1; order++) {
      if (!usedOrders.includes(order)) {
        options.push({ value: String(order), label: this.formatResponsibilityLabel(order) });
      }
    }
    return options;
  }

  get ownerOrderOptions(): readonly { value: string; label: string }[] {
    return this.ownerOrderOptionsFor(this.usedOrdersForSelectedTarget());
  }

  private usedOrdersForSelectedTarget(): number[] {
    const type = this.addForm.controls.coveredTargetType.value ?? 'Position';
    const positionId = this.addForm.controls.coveredPositionId.value;
    const departmentId = this.addForm.controls.coveredDepartmentId.value;

    return this.usedOrdersForTarget(type, positionId || null, departmentId || null);
  }

  /** Options for the inline edit form of an existing manual record; always includes its own current order. */
  editOwnerOrderOptions(record: ManagementCoverageRecordResponse): readonly { value: string; label: string }[] {
    const usedOrders = this.usedOrdersForTarget(
      record.coveredTargetType,
      record.coveredPositionId,
      record.coveredDepartmentId,
      record.id
    );
    return this.ownerOrderOptionsFor(usedOrders, record.ownerOrder);
  }

  private resetOwnerOrderToFirstAvailable(): void {
    const options = this.ownerOrderOptions;
    const currentValue = this.addForm.controls.ownerOrder.value?.toString() ?? '';
    const isCurrentValueStillOffered = options.some((option) => option.value === currentValue);
    if (!isCurrentValueStillOffered && options.length > 0) {
      this.addForm.controls.ownerOrder.setValue(+options[0].value);
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
    this.showAddForm.setValue(!this.showAddForm.value);
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
    this.updateCoverage.emit({ coverageId: record.id, payload: { ownerOrder: this.editOwnerOrderValue() } });
    this.editingCoverageId.set(null);
  }

  onDelete(cov: ManagementCoverageRecordResponse): void {
    if (cov.isLocked) return;
    this.removeCoverage.emit(cov.id);
  }
}
