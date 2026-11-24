import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ModulePermissionGroup,
  PermissionCatalogItem,
  RoleDetailResponse,
  RolePermissionItem,
  RoleSummaryResponse
} from '../../models/role.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent
} from '../../../../shared/ui/data-table/data-table.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { TEXT_LIMITS } from '../../../../shared/constants/text-limits';
import { CharCounterComponent } from '../../../../shared/ui/char-counter/char-counter.component';
import { AppValidators, fieldError } from '../../../../shared/utils/validators';
import { ROLE_LIMITS } from '../../utils/organization-limits';

export interface RoleFormSubmitValue {
  name: string;
  description: string | null;
  selectedPermissionIds: string[];
}

/**
 * The one role popup: create (no role), edit a custom role (details + permissions), or view a
 * system role read-only. Permissions are one shared data table per module.
 */
@Component({
  selector: 'app-role-form-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [CharCounterComponent, StopClickPropagationDirective, CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, DataTableComponent, DataTableCellDirective],
  templateUrl: './role-form-modal.component.html',
  styleUrl: './role-form-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleFormModalComponent implements OnChanges {
  readonly limits = TEXT_LIMITS;
  protected readonly fieldError = fieldError;
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** null = create a new role. */
  @Input() role: RoleSummaryResponse | null = null;
  /** The role's permissions; loads after the popup opens for an existing role. */
  @Input() roleDetail: RoleDetailResponse | null = null;
  @Input({ required: true }) groupedCatalog: readonly ModulePermissionGroup[] = [];
  /** The role's permissions are still loading. */
  @Input() loading = false;
  @Input() saving = false;

  @Output() save = new EventEmitter<RoleFormSubmitValue>();
  @Output() cancelled = new EventEmitter<void>();

  readonly selectedIds = signal<Set<string>>(new Set<string>());

  /**
   * Permissions the role grants that are not in the assignable catalog (platform baseline
   * modules such as roles/settings, seeded onto system roles). Shown read-only so the
   * ticked boxes add up to the count on the roles list.
   */
  readonly platformPermissions = signal<readonly RolePermissionItem[]>([]);
  readonly platformIds = computed<ReadonlySet<string>>(() => new Set(this.platformPermissions().map((p) => p.id)));

  readonly form = this.fb.group({
    name: ['', [AppValidators.name(ROLE_LIMITS.nameMax), AppValidators.pattern(ROLE_LIMITS.namePattern, 'nameChars')]],
    description: ['' as string | null, AppValidators.maxLength(ROLE_LIMITS.descriptionMax)]
  });

  /** One shared data table per module: the module name is the column header. */
  private readonly columnsByModule = new Map<string, readonly DataTableColumn[]>();
  readonly platformColumns: readonly DataTableColumn[] = [{ key: 'permission', label: 'Platform access', wrap: true }];

  readonly permissionKey = (p: PermissionCatalogItem): string => p.id ?? p.code;
  readonly platformKey = (p: RolePermissionItem): string => p.id;
  readonly isPermissionAssignable = (p: PermissionCatalogItem): boolean => !!p.id;
  readonly permissionAriaLabel = (p: { description: string; code: string }): string => `Grant: ${p.description || p.code}`;

  get isEdit(): boolean {
    return !!this.role;
  }

  get readOnly(): boolean {
    return !!this.role?.isSystem;
  }

  columnsFor(group: ModulePermissionGroup): readonly DataTableColumn[] {
    let columns = this.columnsByModule.get(group.module);
    if (!columns) {
      columns = [{ key: 'permission', label: group.moduleTitle, wrap: true }];
      this.columnsByModule.set(group.module, columns);
    }
    return columns;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['role']) {
      this.form.reset({ name: this.role?.name ?? '', description: this.role?.description ?? '' });
    }
    if (!changes['roleDetail'] && !changes['groupedCatalog'] && !changes['role']) return;

    // The detail loads after the popup opens, so seed the selection whenever it arrives,
    // and only from the detail that belongs to this role.
    const detail = this.roleDetail;
    if (!this.role || !detail || detail.id !== this.role.id) {
      if (changes['role']) {
        this.selectedIds.set(new Set<string>());
        this.platformPermissions.set([]);
      }
      return;
    }
    const catalogIds = new Set<string>();
    for (const group of this.groupedCatalog) {
      for (const p of group.permissions) {
        if (p.id) catalogIds.add(p.id);
      }
    }
    this.selectedIds.set(new Set(detail.permissions.filter((p) => catalogIds.has(p.id)).map((p) => p.id)));
    this.platformPermissions.set(detail.permissions.filter((p) => !catalogIds.has(p.id)));
  }

  togglePermission(id: string | null): void {
    if (!id) return;
    this.setPermission(id, !this.selectedIds().has(id));
  }

  setPermission(id: string | null, selected: boolean): void {
    if (!id || this.readOnly) return;
    const current = new Set(this.selectedIds());
    if (selected) {
      current.add(id);
    } else {
      current.delete(id);
    }
    this.selectedIds.set(current);
  }

  setModuleGroup(group: ModulePermissionGroup, checked: boolean): void {
    if (this.readOnly) return;
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
    if (this.readOnly || this.loading) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // The name field sits above the permission tables; after scrolling down to pick
      // permissions its error would be off-screen and the button would seem dead.
      const nameInput = this.host.nativeElement.querySelector<HTMLInputElement>('app-input input');
      nameInput?.scrollIntoView({ block: 'center' });
      nameInput?.focus({ preventScroll: true });
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
