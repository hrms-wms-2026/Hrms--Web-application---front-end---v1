import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { POSITION_TEMPLATE_DRAG_MIME_TYPE, PositionTemplatePackPositionResponse, PositionTreeNodeResponse } from '../../models/position.model';
import { PositionOccupancyDisplay, resolvePositionOccupancy } from '../../utils/position-occupancy';
import { PositionSeatPreviewComponent } from '../position-seat-preview/position-seat-preview.component';

export interface ReparentPositionEvent {
  position: PositionTreeNodeResponse;
  newReportsToPositionId: string | null;
}

export interface TemplateDropOnPositionEvent {
  templatePosition: PositionTemplatePackPositionResponse;
  packName: string;
  targetPosition: PositionTreeNodeResponse;
}

@Component({
  selector: 'app-position-tree-node',
  standalone: true,
  imports: [CommonModule, PositionSeatPreviewComponent],
  templateUrl: './position-tree-node.component.html',
  styleUrl: './position-tree-node.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionTreeNodeComponent {
  @Input({ required: true }) node!: PositionTreeNodeResponse;
  @Input() level = 0;
  @Input() canManage = false;
  @Input() canConfigureAccess = false;
  @Input() departmentNameMap: Record<string, string> = {};
  @Input() isRoot = false;
  /** Read-only views (e.g. an employee's reporting structure) mark one position as "this one". */
  @Input() highlightPositionId: string | null = null;

  @Output() addSubPosition = new EventEmitter<PositionTreeNodeResponse>();
  @Output() editPosition = new EventEmitter<PositionTreeNodeResponse>();
  @Output() viewAccess = new EventEmitter<PositionTreeNodeResponse>();
  @Output() viewCoverage = new EventEmitter<PositionTreeNodeResponse>();
  @Output() archivePosition = new EventEmitter<PositionTreeNodeResponse>();
  @Output() reparentPosition = new EventEmitter<ReparentPositionEvent>();
  @Output() templateDropped = new EventEmitter<TemplateDropOnPositionEvent>();

  readonly menuOpen = signal(false);
  readonly isDragOver = signal(false);
  readonly isTemplateDragOver = signal(false);

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

  get occupancy(): PositionOccupancyDisplay {
    // assignedCount/occupantPreview are the real, populated fields (backed by
    // position_assignments); currentOccupancy is a deprecated placeholder the
    // backend still sends as (null, false) on some endpoints. Prefer assignedCount
    // whenever the backend has provided it.
    const hasAssignedCount = this.node.assignedCount !== undefined;
    return resolvePositionOccupancy({
      positionType: this.node.positionType,
      maxOccupancy: this.node.maxOccupancy,
      currentOccupancy: hasAssignedCount ? this.node.assignedCount : this.node.currentOccupancy,
      currentOccupancyCheckSupported: hasAssignedCount ? true : undefined,
      isActive: this.node.isActive
    });
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

  onAccess(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.viewAccess.emit(this.node);
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
    event.stopPropagation();

    const isTemplateDrag = !!event.dataTransfer?.types.includes(POSITION_TEMPLATE_DRAG_MIME_TYPE);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = isTemplateDrag ? 'copy' : 'move';
    }

    if (isTemplateDrag) {
      this.isTemplateDragOver.set(true);
      this.isDragOver.set(false);
    } else {
      this.isDragOver.set(true);
      this.isTemplateDragOver.set(false);
    }
  }

  onDragLeave(event: DragEvent): void {
    if (!this.canManage) return;
    event.preventDefault();
    this.isDragOver.set(false);
    this.isTemplateDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    if (!this.canManage) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    this.isTemplateDragOver.set(false);

    const templateRaw = event.dataTransfer?.getData(POSITION_TEMPLATE_DRAG_MIME_TYPE);
    if (templateRaw) {
      try {
        const data = JSON.parse(templateRaw);
        if (data && data.position) {
          this.templateDropped.emit({
            templatePosition: data.position,
            packName: data.packName,
            targetPosition: this.node
          });
        }
      } catch {
        // ignore invalid payload
      }
      return;
    }

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
