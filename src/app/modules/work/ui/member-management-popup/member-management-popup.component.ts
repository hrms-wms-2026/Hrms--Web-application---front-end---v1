import { Component, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { ObjectiveMemberItemDto } from '../../models/dto/objective-invitation.dto';

export interface ProjectMemberPopupItem {
  id: string;
  name: string;
}

@Component({
  selector: 'app-member-management-popup',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, AvatarComponent, EmployeePickerComponent],
  template: `
    <app-modal [open]="open()" title="Members" (closed)="closed.emit()">
      @if (pickerOpen() !== null) {
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-[var(--color-text-primary)]">
              {{ pickerOpen() === 'leader' ? 'Choose a new leader' : 'Add a member' }}
            </span>
            <span data-testid="picker-back" (click)="pickerOpen.set(null)">
              <app-button variant="secondary" size="sm">Back</app-button>
            </span>
          </div>
          <app-employee-picker
            [inline]="true"
            [open]="true"
            (selected)="onEmployeePicked($event)"
            (closed)="pickerOpen.set(null)"
          />
        </div>
      } @else if (scope() === 'project') {
        <div class="flex flex-col gap-2">
          @if (canManage()) {
            <span data-testid="add-member-button">
              <app-button variant="secondary" size="sm" (pressed)="pickerOpen.set('member')">+ Add member</app-button>
            </span>
          }
          @for (member of projectMembers(); track member.id) {
            <div data-testid="member-row" class="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2">
              <app-avatar [userName]="member.name" size="sm" />
              <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ member.name }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="flex flex-col gap-2">
          @if (loading()) {
            <p data-testid="members-loading">Loading members…</p>
          }
          @if (canManage()) {
            <span data-testid="add-member-button" (click)="pickerOpen.set('member')">
              <app-button variant="secondary" size="sm">+ Add member</app-button>
            </span>
          }
          @for (member of objectiveMembers(); track member.employeeId) {
            <div
              data-testid="member-row"
              [attr.data-employee-id]="member.employeeId"
              class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2"
            >
              <div class="flex items-center gap-2">
                <app-avatar [avatarUrl]="member.avatarUrl" [userName]="member.name" size="sm" />
                <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ member.name ?? 'Unknown employee' }}</span>
                @if (member.isHead) {
                  <span data-testid="leader-badge" class="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">Leader</span>
                }
                @if (member.pending) {
                  <span data-testid="pending-tag" class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Request pending</span>
                }
              </div>
              @if (canManage() && !member.pending && !member.isHead) {
                <div class="flex items-center gap-1">
                  <span data-testid="remove-button" (click)="removeRequested.emit(member.employeeId)">
                    <app-button variant="secondary" size="sm">Remove</app-button>
                  </span>
                  <span data-testid="transfer-button" (click)="pickerOpen.set('leader')">
                    <app-button variant="secondary" size="sm">Make leader</app-button>
                  </span>
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
      }
    </app-modal>
  `
})
export class MemberManagementPopupComponent {
  scope = input<'project' | 'objective'>('project');
  open = input(false);
  projectMembers = input<readonly ProjectMemberPopupItem[]>([]);
  objectiveMembers = input<readonly ObjectiveMemberItemDto[]>([]);
  loading = input(false);
  canManage = input(false);

  addRequested = output<string>();
  removeRequested = output<string>();
  transferRequested = output<string>();
  closed = output<void>();

  protected readonly pickerOpen = signal<'member' | 'leader' | null>(null);

  onEmployeePicked(employeeId: string): void {
    const mode = this.pickerOpen();
    this.pickerOpen.set(null);
    if (mode === 'member') this.addRequested.emit(employeeId);
    else if (mode === 'leader') this.transferRequested.emit(employeeId);
  }
}
