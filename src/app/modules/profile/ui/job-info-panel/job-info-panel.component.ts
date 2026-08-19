import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { JobInformation } from '../../models/profile.model';

@Component({
  selector: 'app-job-info-panel',
  standalone: true,
  templateUrl: './job-info-panel.component.html',
  styleUrls: ['../profile-panel.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobInfoPanelComponent {
  readonly jobInformation = input.required<JobInformation>();
}
