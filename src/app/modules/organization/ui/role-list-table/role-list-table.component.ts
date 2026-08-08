import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoleSummaryResponse } from '../../models/role.model';

@Component({
  selector: 'app-role-list-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-list-table.component.html',
  styleUrl: './role-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleListTableComponent {
  @Input({ required: true }) roles: readonly RoleSummaryResponse[] = [];
  @Input() canManage = false;

  @Output() editRole = new EventEmitter<RoleSummaryResponse>();
  @Output() managePermissions = new EventEmitter<RoleSummaryResponse>();
  @Output() archiveRole = new EventEmitter<RoleSummaryResponse>();

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

  onEdit(role: RoleSummaryResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.editRole.emit(role);
  }

  onManagePerms(role: RoleSummaryResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.managePermissions.emit(role);
  }

  onArchive(role: RoleSummaryResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.archiveRole.emit(role);
  }
}
