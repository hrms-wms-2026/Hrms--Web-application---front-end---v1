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
}
