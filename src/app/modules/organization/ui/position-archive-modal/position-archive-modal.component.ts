import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PositionArchiveBlockers, PositionListItemResponse, PositionTreeNodeResponse } from '../../models/position.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-position-archive-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './position-archive-modal.component.html',
  styleUrl: './position-archive-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionArchiveModalComponent {
  @Input({ required: true }) position!: PositionListItemResponse | PositionTreeNodeResponse;
  @Input() blockers: PositionArchiveBlockers | null = null;
  @Input() checking = false;
  @Input() saving = false;

  @Output() confirmArchive = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
