import { EmployeeColumnDef } from '../models/employee-columns';
import { EmployeeListItemResponse } from '../models/employee.model';
import { csvCell } from '../../../shared/utils/csv.util';

export { downloadCsv } from '../../../shared/utils/csv.util';

export function toEmployeeCsv(rows: readonly EmployeeListItemResponse[], columns: readonly EmployeeColumnDef[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}
