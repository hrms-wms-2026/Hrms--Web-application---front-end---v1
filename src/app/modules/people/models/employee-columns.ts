import type { FieldIcon } from '../../../shared/ui/field-icon/field-icon.component';
import { EmployeeListItemResponse, EmployeeSortKey } from './employee.model';

export type EmployeeColumnKey =
  | 'employee' | 'position' | 'department' | 'employmentType'
  | 'reportingManager' | 'company' | 'workMode' | 'email' | 'status';

export interface EmployeeColumnDef {
  readonly key: EmployeeColumnKey;
  readonly label: string;
  /** Icon shown next to the field in the Employee fields panel. */
  readonly icon: FieldIcon;
  readonly sortKey?: EmployeeSortKey;
  readonly locked?: boolean;
  readonly value: (employee: EmployeeListItemResponse) => string;
}

export const EMPLOYEE_COLUMNS: readonly EmployeeColumnDef[] = [
  { key: 'employee', label: 'Employee', icon: 'user', sortKey: 'name', locked: true, value: (e) => e.fullName },
  { key: 'position', label: 'Position', icon: 'id-card', sortKey: 'position', value: (e) => e.positionName ?? '' },
  { key: 'department', label: 'Department', icon: 'layers', sortKey: 'department', value: (e) => e.departmentName ?? '' },
  { key: 'employmentType', label: 'Employment', icon: 'briefcase', sortKey: 'employmentType', value: (e) => e.employmentTypeLabel },
  { key: 'reportingManager', label: 'Reporting Manager', icon: 'users', sortKey: 'manager', value: (e) => e.reportingManagerName ?? '' },
  { key: 'company', label: 'Company', icon: 'building', value: (e) => e.legalEntityName ?? '' },
  { key: 'workMode', label: 'Work Mode', icon: 'map-pin', value: (e) => e.workModeLabel ?? '' },
  { key: 'email', label: 'Email', icon: 'mail', value: (e) => e.email },
  { key: 'status', label: 'Status', icon: 'status', value: (e) => e.status }
];

export const DEFAULT_EMPLOYEE_COLUMNS: readonly EmployeeColumnKey[] =
  ['employee', 'position', 'department', 'employmentType', 'reportingManager'];

const STORAGE_KEY = 'employee_list_columns';

/** Per-browser preference; always canonical order, always includes the locked Employee column. */
export function loadEmployeeColumns(): EmployeeColumnKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_EMPLOYEE_COLUMNS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_EMPLOYEE_COLUMNS];
    return EMPLOYEE_COLUMNS.filter((c) => c.locked || parsed.includes(c.key)).map((c) => c.key);
  } catch {
    return [...DEFAULT_EMPLOYEE_COLUMNS];
  }
}

export function saveEmployeeColumns(keys: readonly EmployeeColumnKey[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage blocked (private mode etc.) - the choice just won't persist.
  }
}
