import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
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
  imports: [AvatarComponent, DropdownMenuComponent, DataTableComponent, DataTableCellDirective],
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

  /** The attendance issue shown as the avatar hover popup: red for errors, yellow for warnings. */
  /** Ring + hover tooltip on the avatar: today's attendance problem and/or open alerts awaiting review. */
  protected avatarIssue(
    employee: EmployeeListItemResponse
  ): { label: string; tone: 'critical' | 'warning'; alertCount: number } | null {
    const alertCount = employee.attendanceSummary?.openAlertCount ?? 0;
    const alertsLabel = alertCount > 0 ? `${alertCount} open ${alertCount === 1 ? 'alert' : 'alerts'}` : null;
    const warning = attendanceWarningLabel(employee);
    const attention = warning ? null : attendanceAttentionLabel(employee);
    const issueLabel = warning ?? attention;
    if (!issueLabel && !alertsLabel) return null;
    const tone = warning || (attention && attendanceSeverityClass(employee) === 'emp-attention--critical') ? 'critical' : 'warning';
    const label = [issueLabel, alertsLabel].filter((part): part is string => !!part).join(' · ');
    return { label, tone, alertCount };
  }

  /** Columns with a dedicated cell template; every other column renders its plain value(). */
  private static readonly customCells = new Set<string>(['employee', 'position', 'reportingManager']);

  protected readonly tableColumns = computed<DataTableColumn[]>(() => [
    ...this.columns().map((column) => ({
      key: column.key,
      label: column.label,
      sortable: !!column.sortKey,
      overflowVisible: column.key === 'employee'
    })),
    { key: 'menu', label: 'Actions', hideLabel: true, interactive: true, shrink: true, align: 'end' as const }
  ]);
  protected readonly plainColumns = computed(() =>
    this.columns().filter((column) => !EmployeeDirectoryTableComponent.customCells.has(column.key)));
  /** The shared table tracks sort by column key; the API sorts by sortKey. */
  protected readonly activeSortColumn = computed(() =>
    this.columns().find((column) => column.sortKey && column.sortKey === this.sortBy())?.key ?? null);

  protected readonly trackEmployee = (employee: EmployeeListItemResponse): string => employee.id;
  protected readonly rowTestId = (employee: EmployeeListItemResponse): string => 'employee-row-' + employee.id;
  protected readonly selectTestId = (employee: EmployeeListItemResponse): string => 'employee-select-' + employee.id;
  protected readonly selectAriaLabel = (employee: EmployeeListItemResponse): string => 'Select ' + employee.fullName;
  protected readonly sortTestId = (key: string): string => 'employee-sort-' + key;

  protected readonly menuItemsById = computed(() => {
    const itemsFor = this.rowMenuItems();
    return new Map(this.employees().map((e) => [e.id, itemsFor(e)] as const));
  });

  protected readonly visibleIds = computed(() => this.employees().map((e) => e.id));

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

  protected onSort(columnKey: string): void {
    const sortKey = this.columns().find((column) => column.key === columnKey)?.sortKey;
    if (!sortKey) return;
    const sortDir: SortDirection = sortKey === this.sortBy() && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortChanged.emit({ sortBy: sortKey, sortDir });
  }

  protected openEmployee(employee: EmployeeListItemResponse): void {
    void this.router.navigate(['/people/employees', employee.id]);
  }

  /** The employee's open attendance alerts, reviewed in the Inbox. */
  protected openAlerts(employee: EmployeeListItemResponse, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    void this.router.navigate(['/inbox'], { queryParams: { tab: 'alerts', employee: employee.id } });
  }

  protected onMenuSelected(employee: EmployeeListItemResponse, actionId: string): void {
    this.rowAction.emit({ employee, actionId });
  }
}
