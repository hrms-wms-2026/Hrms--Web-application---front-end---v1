import { LeaveBalanceResponse } from '../models/leave-balance.model';

const HEADER = [
  'Employee',
  'Employee number',
  'Department',
  'Legal entity',
  'Leave type',
  'Code',
  'Year',
  'Entitled',
  'Carried forward',
  'Used',
  'Pending',
  'Remaining',
  'Carry-forward expires'
];

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function balancesToCsv(rows: readonly LeaveBalanceResponse[]): string {
  const lines = rows.map((row) =>
    [
      row.employeeName,
      row.employeeNumber,
      row.departmentName,
      row.legalEntityName,
      row.leaveTypeName,
      row.leaveTypeCode,
      row.year,
      row.entitledDays,
      row.carriedForwardDays,
      row.usedDays,
      row.pendingDays,
      row.remainingDays,
      row.carryForwardExpiresOn
    ]
      .map(csvCell)
      .join(',')
  );
  return [HEADER.join(','), ...lines].join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
