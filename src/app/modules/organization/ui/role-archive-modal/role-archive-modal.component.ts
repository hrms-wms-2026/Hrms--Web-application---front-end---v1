import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoleSummaryResponse } from '../../models/role.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-role-archive-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './role-archive-modal.component.html',
  styleUrl: './role-archive-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleArchiveModalComponent {
  @Input({ required: true }) role!: RoleSummaryResponse;
  @Input() saving = false;

  @Output() confirmArchive = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
