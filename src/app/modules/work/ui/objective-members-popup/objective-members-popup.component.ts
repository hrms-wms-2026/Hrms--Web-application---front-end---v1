import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { ObjectiveMemberItemDto } from '../../models/dto/objective-invitation.dto';

@Component({
  selector: 'app-objective-members-popup',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, EmployeePickerComponent, EmployeeAvatarComponent],
  template: `
    <app-modal [open]="open()" title="Members" (closed)="closed.emit()">
      <div class="flex flex-col gap-2">
        @if (canManage()) {
          <span data-testid="add-member-button" (click)="pickerOpen.set('member')">
            <app-button variant="secondary" size="sm">+ Add member</app-button>
          </span>
        }
        @for (member of members(); track member.employeeId) {
          <div
            data-testid="member-row"
            [attr.data-employee-id]="member.employeeId"
            class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2"
          >
            <div class="flex items-center gap-2">
              <app-employee-avatar [employeeId]="member.employeeId" />
              <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ directory.get(member.employeeId)?.name ?? 'Unknown employee' }}</span>
              @if (member.isHead) {
                <span data-testid="leader-badge" class="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">Leader</span>
              }
              @if (member.pending) {
                <span data-testid="pending-tag" class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Request pending</span>
              }
            </div>
            @if (canManage() && !member.pending) {
              <div class="flex items-center gap-1">
                @if (!member.isHead) {
                  <span data-testid="remove-button" (click)="removeRequested.emit(member.employeeId)">
                    <app-button variant="secondary" size="sm">Remove</app-button>
                  </span>
                  <span data-testid="transfer-button" (click)="pickerOpen.set('leader')">
                    <app-button variant="secondary" size="sm">Make leader</app-button>
                  </span>
                }
              </div>
            }
            @if (canManage() && member.pending) {
              <span data-testid="remove-button" (click)="removeRequested.emit(member.employeeId)">
                <app-button variant="secondary" size="sm">Cancel</app-button>
              </span>
            }
          </div>
        }
      </div>
    </app-modal>
    <app-employee-picker
      [open]="pickerOpen() !== null"
      (selected)="onEmployeePicked($event)"
      (closed)="pickerOpen.set(null)"
    />
  `
})
export class ObjectiveMembersPopupComponent {
  protected readonly directory = inject(EmployeeDirectoryStore);

  open = input(false);
  members = input<readonly ObjectiveMemberItemDto[]>([]);
  loading = input(false);
  canManage = input(false);

  addRequested = output<string>();
  removeRequested = output<string>();
  transferRequested = output<string>();
  closed = output<void>();

  pickerOpen = signal<'member' | 'leader' | null>(null);

  constructor() {
    effect(() => {
      const ids = this.members().map((m) => m.employeeId);
      untracked(() => void this.directory.ensureLoaded(ids));
    });
  }

  onEmployeePicked(employeeId: string): void {
    const mode = this.pickerOpen();
    this.pickerOpen.set(null);
    if (mode === 'member') this.addRequested.emit(employeeId);
    else if (mode === 'leader') this.transferRequested.emit(employeeId);
  }
}
