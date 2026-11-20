import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RoleSummaryResponse } from '../../models/role.model';
import { ArchiveConfirmModalComponent } from '../archive-confirm-modal/archive-confirm-modal.component';

@Component({
  selector: 'app-role-archive-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [ArchiveConfirmModalComponent],
  templateUrl: './role-archive-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleArchiveModalComponent {
  readonly role = input.required<RoleSummaryResponse>();
  readonly saving = input(false);

  readonly confirmArchive = output<void>();
  readonly cancelled = output<void>();
}
