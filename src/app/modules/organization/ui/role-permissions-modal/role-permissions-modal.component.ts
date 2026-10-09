import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModulePermissionGroup, RoleDetailResponse, RoleSummaryResponse } from '../../models/role.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-role-permissions-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './role-permissions-modal.component.html',
  styleUrl: './role-permissions-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RolePermissionsModalComponent implements OnInit {
  @Input({ required: true }) role!: RoleSummaryResponse;
  @Input() roleDetail: RoleDetailResponse | null = null;
  @Input({ required: true }) groupedCatalog: readonly ModulePermissionGroup[] = [];
  @Input() loading = false;
  @Input() saving = false;

  @Output() savePermissions = new EventEmitter<string[]>();
  @Output() cancel = new EventEmitter<void>();

  readonly selectedIds = signal<Set<string>>(new Set<string>());

  ngOnInit(): void {
    if (this.roleDetail && this.roleDetail.permissions) {
      const ids = new Set(this.roleDetail.permissions.map((p) => p.id));
      this.selectedIds.set(ids);
    }
  }

  isPermissionSelected(id: string | null): boolean {
    if (!id) return false;
    return this.selectedIds().has(id);
  }

  togglePermission(id: string | null): void {
    if (!id || this.role.isSystem) return;
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  isModuleAllSelected(group: ModulePermissionGroup): boolean {
    if (!group.permissions || group.permissions.length === 0) return false;
    const current = this.selectedIds();
    return group.permissions.every((p) => p.id && current.has(p.id));
  }

  toggleModuleGroup(group: ModulePermissionGroup, event: Event): void {
    if (this.role.isSystem) return;
    const checked = (event.target as HTMLInputElement).checked;
    const current = new Set(this.selectedIds());
    for (const p of group.permissions) {
      if (p.id) {
        if (checked) {
          current.add(p.id);
        } else {
          current.delete(p.id);
        }
      }
    }
    this.selectedIds.set(current);
  }

  onSave(): void {
    this.savePermissions.emit(Array.from(this.selectedIds()));
  }
}
