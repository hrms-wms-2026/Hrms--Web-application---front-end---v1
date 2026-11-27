import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Dashed empty-state box with a round icon, shared by the attendance history and my-requests lists. */
@Component({
  selector: 'app-attendance-empty-state',
  templateUrl: './attendance-empty-state.component.html',
  styleUrl: './attendance-empty-state.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceEmptyStateComponent {
  /** `d` attributes of the stroked icon paths (24x24 outline icon). */
  readonly iconPaths = input.required<readonly string[]>();
  readonly message = input.required<string>();
}
