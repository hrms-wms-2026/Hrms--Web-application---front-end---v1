import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DepartmentArchiveDependencyResponse, DepartmentListItemResponse, DepartmentTreeNodeResponse } from '../../models/department.model';
import { ArchiveConfirmModalComponent, ArchiveImpact } from '../archive-confirm-modal/archive-confirm-modal.component';

@Component({
  selector: 'app-department-archive-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [ArchiveConfirmModalComponent],
  templateUrl: './department-archive-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentArchiveModalComponent {
  readonly department = input.required<DepartmentListItemResponse | DepartmentTreeNodeResponse>();
  readonly dependency = input<DepartmentArchiveDependencyResponse | null>(null);
  readonly checking = input(false);
  readonly saving = input(false);

  readonly confirmArchive = output<void>();
  readonly cancelled = output<void>();

  protected readonly impacts = computed<readonly ArchiveImpact[] | null>(() => {
    const blockers = this.dependency()?.blockers;
    if (!blockers) return null;
    return [
      { label: 'Child departments', count: blockers.activeChildCount },
      { label: 'Active employees', count: blockers.activeEmployeeCount },
      { label: 'Positions', count: blockers.activePositionCount }
    ];
  });
}
