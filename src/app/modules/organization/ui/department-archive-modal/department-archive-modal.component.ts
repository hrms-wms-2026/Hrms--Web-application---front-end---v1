import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepartmentArchiveDependencyResponse, DepartmentListItemResponse, DepartmentTreeNodeResponse } from '../../models/department.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-department-archive-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './department-archive-modal.component.html',
  styleUrl: './department-archive-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentArchiveModalComponent {
  @Input({ required: true }) department!: DepartmentListItemResponse | DepartmentTreeNodeResponse;
  @Input() dependency: DepartmentArchiveDependencyResponse | null = null;
  @Input() checking = false;
  @Input() saving = false;

  @Output() confirmArchive = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
