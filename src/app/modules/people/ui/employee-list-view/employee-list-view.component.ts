import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { EmployeeListItemResponse } from '../../models/employee.model';
import {
  avatarInitials,
  attendanceWarningLabel,
  attendanceSeverityClass,
  attendanceAttentionLabel,
  attendanceStatusLabel,
  breakOverageLabel
} from '../../utils/employee-view.utils';

@Component({
  selector: 'app-employee-list-view',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  templateUrl: './employee-list-view.component.html',
  styleUrl: './employee-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListViewComponent {
  employees = input.required<readonly EmployeeListItemResponse[]>();

  readonly avatarInitials = avatarInitials;
  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceSeverityClass = attendanceSeverityClass;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;
}
