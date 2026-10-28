import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoleSummaryResponse } from '../../models/role.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

@Component({
  selector: 'app-role-archive-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [StopClickPropagationDirective, CommonModule, ButtonComponent],
  templateUrl: './role-archive-modal.component.html',
  styleUrl: './role-archive-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleArchiveModalComponent {
  @Input({ required: true }) role!: RoleSummaryResponse;
  @Input() saving = false;

  @Output() confirmArchive = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
