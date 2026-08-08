import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepartmentListItemResponse } from '../../models/department.model';

@Component({
  selector: 'app-department-list-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './department-list-table.component.html',
  styleUrl: './department-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentListTableComponent {
  @Input({ required: true }) departments: readonly DepartmentListItemResponse[] = [];
  @Input() canManage = false;

  @Output() editDepartment = new EventEmitter<DepartmentListItemResponse>();
  @Output() archiveDepartment = new EventEmitter<DepartmentListItemResponse>();
  @Output() restoreDepartment = new EventEmitter<DepartmentListItemResponse>();

  readonly openMenuId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  onEdit(dept: DepartmentListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.editDepartment.emit(dept);
  }

  onArchive(dept: DepartmentListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.archiveDepartment.emit(dept);
  }

  onRestore(dept: DepartmentListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.restoreDepartment.emit(dept);
  }
}
