import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PositionListItemResponse } from '../../models/position.model';
import { PositionOccupancyDisplay, resolvePositionOccupancy } from '../../utils/position-occupancy';
import { PositionSeatPreviewComponent } from '../position-seat-preview/position-seat-preview.component';

@Component({
  selector: 'app-position-list-table',
  standalone: true,
  imports: [CommonModule, PositionSeatPreviewComponent],
  templateUrl: './position-list-table.component.html',
  styleUrl: './position-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionListTableComponent {
  @Input({ required: true }) positions: readonly PositionListItemResponse[] = [];
  @Input() canManage = false;
  @Input() canConfigureAccess = false;
  @Input() departmentNameMap: Record<string, string> = {};
  @Input() positionNameMap: Record<string, string> = {};

  @Output() editPosition = new EventEmitter<PositionListItemResponse>();
  @Output() viewAccess = new EventEmitter<PositionListItemResponse>();
  @Output() viewCoverage = new EventEmitter<PositionListItemResponse>();
  @Output() archivePosition = new EventEmitter<PositionListItemResponse>();
  @Output() restorePosition = new EventEmitter<PositionListItemResponse>();

  readonly openMenuId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  getDepartmentName(deptId: string | null): string {
    if (!deptId) return 'General';
    return this.departmentNameMap[deptId] || 'General';
  }

  getReportsToName(reportsToId: string | null): string {
    if (!reportsToId) return '—';
    return this.positionNameMap[reportsToId] || 'Root Position';
  }

  getOccupancy(pos: PositionListItemResponse): PositionOccupancyDisplay {
    // assignedCount/occupantPreview are the real, populated fields (backed by
    // position_assignments); currentOccupancy is a deprecated placeholder the
    // backend still sends as (null, false) here. Prefer assignedCount whenever
    // the backend has provided it.
    const hasAssignedCount = pos.assignedCount !== undefined;
    return resolvePositionOccupancy({
      positionType: pos.positionType,
      maxOccupancy: pos.maxOccupancy,
      currentOccupancy: hasAssignedCount ? pos.assignedCount : pos.currentOccupancy,
      currentOccupancyCheckSupported: hasAssignedCount ? true : pos.currentOccupancyCheckSupported,
      isActive: pos.isActive
    });
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  onEdit(pos: PositionListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.editPosition.emit(pos);
  }

  onAccess(pos: PositionListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.viewAccess.emit(pos);
  }

  onCoverage(pos: PositionListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.viewCoverage.emit(pos);
  }

  onArchive(pos: PositionListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.archivePosition.emit(pos);
  }

  onRestore(pos: PositionListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.restorePosition.emit(pos);
  }
}
