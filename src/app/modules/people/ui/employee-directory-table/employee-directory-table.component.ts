import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { EmployeeColumnDef } from '../../models/employee-columns';
import { EmployeeListItemResponse, EmployeeSortKey, SortDirection } from '../../models/employee.model';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
import {
  attendanceAttentionLabel,
  attendanceSeverityClass,
  attendanceStatusLabel,
  attendanceWarningLabel,
  breakOverageLabel
} from '../../utils/employee-view.utils';

@Component({
  selector: 'app-employee-directory-table',
  standalone: true,
  imports: [AvatarComponent, DropdownMenuComponent, EmptyStateComponent],
  templateUrl: './employee-directory-table.component.html',
  styleUrl: './employee-directory-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDirectoryTableComponent {
  private readonly router = inject(Router);
  protected readonly directory = inject(EmployeeDirectoryStore);

  readonly employees = input.required<readonly EmployeeListItemResponse[]>();
  readonly columns = input.required<readonly EmployeeColumnDef[]>();
  readonly sortBy = input<EmployeeSortKey | null>(null);
  readonly sortDir = input<SortDirection>('asc');
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly rowMenuItems = input<(employee: EmployeeListItemResponse) => MenuItem[]>(() => []);

  readonly sortChanged = output<{ sortBy: EmployeeSortKey; sortDir: SortDirection }>();
  readonly selectionChanged = output<{ id: string; selected: boolean }>();
  readonly selectAllChanged = output<{ ids: string[]; selected: boolean }>();
  readonly rowAction = output<{ employee: EmployeeListItemResponse; actionId: string }>();

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceSeverityClass = attendanceSeverityClass;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;

  protected readonly menuItemsById = computed(() => {
    const itemsFor = this.rowMenuItems();
    return new Map(this.employees().map((e) => [e.id, itemsFor(e)] as const));
  });

  protected readonly visibleIds = computed(() => this.employees().map((e) => e.id));
  protected readonly allSelected = computed(() => {
    const ids = this.visibleIds();
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  });
  protected readonly someSelected = computed(() =>
    !this.allSelected() && this.visibleIds().some((id) => this.selectedIds().has(id)));

  constructor() {
    effect(() => {
      const employees = this.employees();
      untracked(() => {
        this.directory.seed(employees.map((employee) => ({
          id: employee.id,
          name: employee.fullName,
          avatarFileId: employee.avatarFileId ?? null
        })));

        const managerIds = employees
          .map((employee) => employee.reportingManagerId)
          .filter((id): id is string => id !== null);
        void this.directory.ensureLoaded(managerIds);
      });
    });
  }

  protected ariaSort(column: EmployeeColumnDef): 'ascending' | 'descending' | 'none' {
    if (!column.sortKey || column.sortKey !== this.sortBy()) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected onSort(column: EmployeeColumnDef): void {
    if (!column.sortKey) return;
    const sortDir: SortDirection = column.sortKey === this.sortBy() && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortChanged.emit({ sortBy: column.sortKey, sortDir });
  }

  protected openEmployee(employee: EmployeeListItemResponse): void {
    void this.router.navigate(['/people/employees', employee.id]);
  }

  protected onRowSelect(id: string, event: Event): void {
    this.selectionChanged.emit({ id, selected: (event.target as HTMLInputElement).checked });
  }

  protected onSelectAll(event: Event): void {
    this.selectAllChanged.emit({ ids: this.visibleIds(), selected: (event.target as HTMLInputElement).checked });
  }

  protected onMenuSelected(employee: EmployeeListItemResponse, actionId: string): void {
    this.rowAction.emit({ employee, actionId });
  }
}
