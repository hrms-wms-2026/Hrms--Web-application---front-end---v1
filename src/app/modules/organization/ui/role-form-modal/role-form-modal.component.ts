import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModulePermissionGroup, RoleDetailResponse, RoleSummaryResponse } from '../../models/role.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';

export interface RoleFormSubmitValue {
  name: string;
  description: string | null;
  selectedPermissionIds: string[];
}

@Component({
  selector: 'app-role-form-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './role-form-modal.component.html',
  styleUrl: './role-form-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  @Input() role: RoleSummaryResponse | RoleDetailResponse | null = null;
  @Input({ required: true }) groupedCatalog: readonly ModulePermissionGroup[] = [];
  @Input() loading = false;

  @Output() save = new EventEmitter<RoleFormSubmitValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly selectedIds = signal<Set<string>>(new Set<string>());

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['' as string | null, [Validators.maxLength(500)]]
  });

  get isEdit(): boolean {
    return !!this.role;
  }

  ngOnInit(): void {
    if (this.role) {
      this.form.patchValue({
        name: this.role.name,
        description: this.role.description
      });

      // If full detail passed with permissions array
      if ('permissions' in this.role && this.role.permissions) {
        const ids = new Set(this.role.permissions.map((p) => p.id));
        this.selectedIds.set(ids);
      }
    }
  }

  isPermissionSelected(id: string | null): boolean {
    if (!id) return false;
    return this.selectedIds().has(id);
  }

  togglePermission(id: string | null): void {
    if (!id) return;
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

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.getRawValue();
    this.save.emit({
      name: (val.name || '').trim(),
      description: val.description ? val.description.trim() : null,
      selectedPermissionIds: Array.from(this.selectedIds())
    });
  }
}
