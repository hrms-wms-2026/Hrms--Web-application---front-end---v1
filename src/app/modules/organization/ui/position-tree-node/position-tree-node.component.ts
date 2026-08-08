import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PositionTreeNodeResponse } from '../../models/position.model';

export interface ReparentPositionEvent {
  position: PositionTreeNodeResponse;
  newReportsToPositionId: string | null;
}

@Component({
  selector: 'app-position-tree-node',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './position-tree-node.component.html',
  styleUrl: './position-tree-node.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionTreeNodeComponent {
  @Input({ required: true }) node!: PositionTreeNodeResponse;
  @Input() level = 0;
  @Input() canManage = false;
  @Input() departmentNameMap: Record<string, string> = {};
  @Input() isRoot = false;

  @Output() addSubPosition = new EventEmitter<PositionTreeNodeResponse>();
  @Output() editPosition = new EventEmitter<PositionTreeNodeResponse>();
  @Output() viewCoverage = new EventEmitter<PositionTreeNodeResponse>();
  @Output() archivePosition = new EventEmitter<PositionTreeNodeResponse>();
  @Output() reparentPosition = new EventEmitter<ReparentPositionEvent>();

  readonly menuOpen = signal(false);
  readonly isDragOver = signal(false);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  get resolvedDepartmentName(): string {
    if (this.node.departmentName) return this.node.departmentName;
    if (this.node.departmentId && this.departmentNameMap[this.node.departmentId]) {
      return this.departmentNameMap[this.node.departmentId];
    }
    return 'General';
  }

  get statusBadge(): { label: string; type: 'occupied' | 'vacant' | 'available' } {
    const isUnique = (this.node.positionType || '').toLowerCase() === 'unique';
    if (isUnique) {
      return this.node.maxOccupancy === 1
        ? { label: 'Occupied', type: 'occupied' }
        : { label: 'Vacant', type: 'vacant' };
    } else {
      return { label: 'Available capacity', type: 'available' };
    }
  }

  get iconCategory(): 'ceo' | 'finance' | 'hr' | 'ops' | 'general' {
    const name = (this.node.name || '').toLowerCase();
    const code = (this.node.code || '').toLowerCase();
    const dept = (this.resolvedDepartmentName || '').toLowerCase();

    if (name.includes('ceo') || name.includes('chief executive') || code === 'ceo') return 'ceo';
    if (name.includes('finan') || dept.includes('finan') || code.includes('fin')) return 'finance';
    if (name.includes('hr') || name.includes('human resource') || dept.includes('human') || code.includes('hr')) return 'hr';
    if (name.includes('operat') || name.includes('support') || dept.includes('operat') || code.includes('ops')) return 'ops';
    return 'general';
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onAddSub(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.addSubPosition.emit(this.node);
  }

  onEdit(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.editPosition.emit(this.node);
  }

  onCoverage(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.viewCoverage.emit(this.node);
  }

  onArchive(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.archivePosition.emit(this.node);
  }

  // ── Native Drag & Drop Handlers ───────────────────────────
  onDragStart(event: DragEvent): void {
    if (!this.canManage) return;
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', this.node.id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent): void {
    if (!this.canManage) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    if (!this.canManage) return;
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    if (!this.canManage) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const draggedId = event.dataTransfer?.getData('text/plain');
    if (!draggedId || draggedId === this.node.id) return;

    // Check if dragging onto self or direct parent
    if (this.node.reportsToPositionId === draggedId) return;

    this.reparentPosition.emit({
      position: { id: draggedId } as PositionTreeNodeResponse,
      newReportsToPositionId: this.node.id
    });
  }
}
