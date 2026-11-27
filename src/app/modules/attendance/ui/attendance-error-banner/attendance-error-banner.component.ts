import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

/** Error banner with an optional "Try again" button, shared by the attendance history and my-requests lists. */
@Component({
  selector: 'app-attendance-error-banner',
  imports: [ButtonComponent],
  templateUrl: './attendance-error-banner.component.html',
  styleUrl: './attendance-error-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceErrorBannerComponent {
  readonly message = input.required<string>();
  readonly canRetry = input(true);

  readonly retryRequested = output<void>();
}
