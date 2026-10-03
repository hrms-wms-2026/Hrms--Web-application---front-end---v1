import { EmployeeColumnDef } from '../models/employee-columns';
import { EmployeeListItemResponse } from '../models/employee.model';

function csvCell(raw: string): string {
  // Leading = + - @ tab/CR make spreadsheet apps evaluate the cell as a formula.
  const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toEmployeeCsv(rows: readonly EmployeeListItemResponse[], columns: readonly EmployeeColumnDef[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens the file as UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
