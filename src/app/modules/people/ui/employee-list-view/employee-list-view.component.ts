import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmployeeListItemResponse } from '../../models/employee.model';
import {
  attendanceWarningLabel,
  attendanceSeverityClass,
  attendanceAttentionLabel,
  attendanceStatusLabel,
  breakOverageLabel
} from '../../utils/employee-view.utils';

@Component({
  selector: 'app-employee-list-view',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, AvatarComponent],
  templateUrl: './employee-list-view.component.html',
  styleUrl: './employee-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListViewComponent {
  employees = input.required<readonly EmployeeListItemResponse[]>();

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceSeverityClass = attendanceSeverityClass;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;
}
