import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PositionArchiveBlockers, PositionListItemResponse, PositionTreeNodeResponse } from '../../models/position.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

@Component({
  selector: 'app-position-archive-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [StopClickPropagationDirective, CommonModule, ButtonComponent],
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
  @Output() cancelled = new EventEmitter<void>();
}
