import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { EmployeeListItemResponse } from '../../models/employee.model';

@Component({
  selector: 'app-employee-table',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  templateUrl: './employee-table.component.html',
  styleUrl: './employee-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeTableComponent {
  employees = input.required<readonly EmployeeListItemResponse[]>();

  avatarInitials(name: string): string {
    if (!name) return 'E';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  attendanceWarningLabel(employee: EmployeeListItemResponse): string | null {
    const summary = employee.attendanceSummary;
    if (summary?.showNotClockedInWarning !== true) return null;
    return summary.warningLabel?.trim() || summary.attentionLabel?.trim() || 'Still has not clocked in';
  }

  attendanceSeverityClass(employee: EmployeeListItemResponse): string {
    const severity = employee.attendanceSummary?.attentionSeverity?.trim().toLowerCase();
    if (severity === 'critical' || severity === 'error') return 'emp-attention--critical';
    if (severity === 'warning') return 'emp-attention--warning';
    return 'emp-attention--neutral';
  }

  attendanceAttentionLabel(employee: EmployeeListItemResponse): string | null {
    const summary = employee.attendanceSummary;
    if (summary?.showNotClockedInWarning === true) return null;
    return summary?.attentionLabel?.trim() || null;
  }

  attendanceStatusLabel(employee: EmployeeListItemResponse): string | null {
    return employee.attendanceSummary?.attendanceStatusLabel?.trim() || null;
  }

  breakOverageLabel(employee: EmployeeListItemResponse): string | null {
    const summary = employee.attendanceSummary;
    const overageMinutes = summary?.breakOverageMinutes;
    if (!summary || (summary.isOverBreakAllowance !== true && !(typeof overageMinutes === 'number' && overageMinutes > 0))) {
      return null;
    }
    if (summary.attentionLabel?.toLowerCase().includes('break') && summary.attentionLabel.toLowerCase().includes('exceed')) {
      return null;
    }
    if (typeof overageMinutes !== 'number' || overageMinutes <= 0) return null;
    return `Break exceeded by ${overageMinutes} min`;
  }
}
