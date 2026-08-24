import { Component, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { ProjectMemberAvatar } from '../../models/project.model';

@Component({
  selector: 'app-project-members-popup',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, AvatarComponent, EmployeePickerComponent],
  template: `
    <app-modal [open]="open()" title="Members" (closed)="closed.emit()">
      <div class="flex flex-col gap-2">
        @if (canManage()) {
          <span data-testid="add-member-button">
            <app-button variant="secondary" size="sm" (pressed)="pickerOpen.set(true)">+ Add member</app-button>
          </span>
        }
        @for (member of members(); track member.userId) {
          <div data-testid="member-row" class="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2">
            <app-avatar [userName]="member.displayName" size="sm" />
            <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ member.displayName }}</span>
          </div>
        }
      </div>
    </app-modal>
    <app-employee-picker
      [open]="pickerOpen()"
      (selected)="onEmployeePicked($event)"
      (closed)="pickerOpen.set(false)"
    />
  `
})
export class ProjectMembersPopupComponent {
  open = input(false);
  members = input<readonly ProjectMemberAvatar[]>([]);
  canManage = input(false);

  addRequested = output<string>();
  closed = output<void>();

  pickerOpen = signal(false);

  onEmployeePicked(employeeId: string): void {
    this.pickerOpen.set(false);
    this.addRequested.emit(employeeId);
  }
}
