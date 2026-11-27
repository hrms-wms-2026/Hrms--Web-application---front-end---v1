import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PositionArchiveBlockers, PositionListItemResponse, PositionTreeNodeResponse } from '../../models/position.model';
import { ArchiveConfirmModalComponent, ArchiveImpact } from '../archive-confirm-modal/archive-confirm-modal.component';

@Component({
  selector: 'app-position-archive-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [ArchiveConfirmModalComponent],
  templateUrl: './position-archive-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionArchiveModalComponent {
  readonly position = input.required<PositionListItemResponse | PositionTreeNodeResponse>();
  readonly blockers = input<PositionArchiveBlockers | null>(null);
  readonly checking = input(false);
  readonly saving = input(false);

  readonly confirmArchive = output<void>();
  readonly cancelled = output<void>();

  protected readonly impacts = computed<readonly ArchiveImpact[] | null>(() => {
    const blockers = this.blockers();
    if (!blockers) return null;
    return [
      { label: 'Department Head assignments', count: blockers.headOfDepartments },
      { label: 'Child reporting positions', count: blockers.activeChildPositions }
    ];
  });

  protected readonly blockerMessages = computed<readonly string[]>(() => {
    const blockers = this.blockers();
    const messages: string[] = [];
    if (blockers && blockers.headOfDepartments > 0) {
      messages.push('Change or clear the Department Head before deleting this position.');
    }
    if (blockers && blockers.activeChildPositions > 0) {
      messages.push('Reassign child positions to a new reporting position first.');
    }
    return messages;
  });
}
