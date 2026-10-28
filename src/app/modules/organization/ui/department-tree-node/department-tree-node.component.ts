import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepartmentTreeNodeResponse } from '../../models/department.model';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

@Component({
  selector: 'app-department-tree-node',
  standalone: true,
  imports: [StopClickPropagationDirective, CommonModule],
  templateUrl: './department-tree-node.component.html',
  styleUrl: './department-tree-node.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentTreeNodeComponent {
  @Input({ required: true }) node!: DepartmentTreeNodeResponse;
  @Input() level = 0;
  @Input() canManage = false;

  @Output() addSubdepartment = new EventEmitter<DepartmentTreeNodeResponse>();
  @Output() editDepartment = new EventEmitter<DepartmentTreeNodeResponse>();
  @Output() archiveDepartment = new EventEmitter<DepartmentTreeNodeResponse>();

  readonly expanded = signal(true);
  readonly menuOpen = signal(false);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  toggleExpand(event: Event): void {
    event.stopPropagation();
    this.expanded.update((v) => !v);
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
    this.addSubdepartment.emit(this.node);
  }

  onEdit(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.editDepartment.emit(this.node);
  }

  onArchive(event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.archiveDepartment.emit(this.node);
  }
}
