import { Component, computed, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { isLeafObjective } from '../../utils/project.mapper';

@Component({
  selector: 'app-tree-explanation-panel',
  standalone: true,
  imports: [CardComponent, EmployeeAvatarComponent],
  template: `
    <app-card>
<div data-testid="tree-explanation-panel" class="flex flex-col gap-5 p-4">
        <div class="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div class="min-w-0">
            <div class="mb-2 flex items-center gap-2">
              <span class="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                {{ kindLabel() }} Details
              </span>
            </div>
            <h2 class="truncate text-base font-bold leading-tight text-[var(--color-text-primary)]">{{ node().title }}</h2>
            @if (kind() === 'sprint' && node().status; as status) {
              <span data-testid="panel-status" class="mt-2 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">{{ status }}</span>
            }
            @if (kind() === 'task' && node().status; as status) {
              <span data-testid="panel-status" class="mt-2 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">{{ status }}</span>
            }
            @if (kind() === 'objective' && node().isAchieved) {
              <span data-testid="panel-achieved" class="mt-2 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">Achieved</span>
            }
          </div>
        </div>

        @if (node().description; as description) {
          <p data-testid="panel-description" class="text-xs leading-relaxed text-[var(--color-text-secondary)]">{{ description }}</p>
        }

        <div class="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/30 px-3 py-1 text-xs">
          @if (kind() === 'objective') {
            <div class="flex items-center justify-between py-2 border-b border-[var(--color-border)]/50">
              <span class="text-[var(--color-text-secondary)] font-medium">Owner</span>
              <span data-testid="panel-owner">{{ node().ownerName ?? '—' }}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-[var(--color-border)]/50">
              <span class="text-[var(--color-text-secondary)] font-medium">Start Date</span>
              <span class="font-semibold text-[var(--color-text-primary)]">{{ node().startDate }}</span>
            </div>
            <div class="flex items-center justify-between py-2">
              <span class="text-[var(--color-text-secondary)] font-medium">Target Date</span>
              <span class="font-semibold text-[var(--color-text-primary)]">{{ node().endDate }}</span>
            </div>
          }
          @if (kind() === 'sprint') {
            <div class="flex items-center justify-between py-2">
              <span class="text-[var(--color-text-secondary)] font-medium">Window</span>
              <span class="font-semibold text-[var(--color-text-primary)]">{{ node().startDate }} – {{ node().endDate }}</span>
            </div>
          }
          @if (kind() === 'task') {
            <div class="flex items-center justify-between py-2">
              <span class="text-[var(--color-text-secondary)] font-medium">Assignee</span>
              <span data-testid="panel-assignee">
                @if (assigneeId(); as id) {
                  <app-employee-avatar [employeeId]="id" [showName]="true" />
                } @else {
                  Unassigned
                }
              </span>
            </div>
          }
        </div>

        @if (kind() !== 'task') {
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center shadow-sm">
              <div class="text-base font-bold text-[var(--color-text-primary)]">{{ node().allocatedHours }}h</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Allocated</div>
            </div>
            <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center shadow-sm">
              <div class="text-base font-bold text-[var(--color-text-primary)]">{{ node().completedHours }}h</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Completed</div>
            </div>
            <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center shadow-sm">
              <div class="text-base font-bold text-[var(--color-text-primary)]">{{ hoursProgress() }}%</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Progress</div>
            </div>
          </div>
        }

        @if (kind() === 'sprint') {
          <span data-testid="panel-progress-track" class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
            <span class="block h-full rounded-full bg-[var(--color-accent)]" [style.width.%]="node().progress"></span>
          </span>
        }

        <div class="border-t border-[var(--color-border)] pt-4">
          <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Quick actions</div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          @if (kind() === 'objective' && node().isOwner) {
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-sub" (click)="createRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>Sub module</span></button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-edit" (click)="editRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><span>Edit module</span></button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-members" (click)="membersRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg><span>Members</span></button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-task" (click)="createTaskRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></svg><span>Add work item</span></button>
            @if (isLeaf()) {
              <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-sprint" (click)="createSprintRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg><span>Add sprint</span></button>
            }
<button type="button" class="{{ primaryBtn }} col-span-2" data-testid="panel-achieve" (click)="achieveRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3" /></svg><span>{{ node().isAchieved ? 'Unachieve module' : 'Achieve module' }}</span></button>
          }
          @if (kind() === 'sprint' && node().isOwner) {
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-task" (click)="createTaskRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></svg><span>Create work item</span></button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-edit" (click)="editRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><span>Edit sprint</span></button>
            <button type="button" class="{{ primaryBtn }}" data-testid="panel-achieve-sprint" (click)="achieveSprintRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 4h3v3a3 3 0 0 1-3 3" /></svg><span>Achieve sprint</span></button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-complete-sprint" (click)="completeSprintRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg><span>Complete sprint</span></button>
            @if (node().status === 'complete' || node().status === 'achieved') {
              <button type="button" class="{{ secondaryBtn }}" data-testid="panel-delete-sprint" (click)="deleteSprintRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg><span>Delete sprint</span></button>
            }
          }
          @if (kind() === 'task') {
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-edit" (click)="editRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><span>Edit task</span></button>
            @if (node().isOwner) {
              <button type="button" class="{{ secondaryBtn }}" data-testid="panel-delete" (click)="deleteRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg><span>Delete task</span></button>
            }
          }
          </div>
        </div>
      </div>
    </app-card>
  `
})
export class TreeExplanationPanelComponent {
  node = input.required<MilestoneTreeNode>();

  editRequested = output<MilestoneTreeNode>();
  membersRequested = output<MilestoneTreeNode>();
  achieveRequested = output<MilestoneTreeNode>();
  createRequested = output<MilestoneTreeNode>();
  createSprintRequested = output<MilestoneTreeNode>();
  createTaskRequested = output<MilestoneTreeNode>();
  achieveSprintRequested = output<MilestoneTreeNode>();
  completeSprintRequested = output<MilestoneTreeNode>();
  /** Only offered for a complete or achieved sprint. */
  deleteSprintRequested = output<MilestoneTreeNode>();
  deleteRequested = output<MilestoneTreeNode>();

readonly primaryBtn = 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-[filter,transform] hover:brightness-95 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';
  readonly secondaryBtn = 'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-center text-sm font-medium text-[var(--color-text-secondary)] shadow-sm transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';

  readonly kind = computed(() => this.node().kind ?? 'objective');
  readonly kindLabel = computed(() => {
    const kind = this.kind();
    if (kind === 'sprint') return 'Sprint';
    if (kind === 'task') return 'Task';
    return 'Module';
  });
  readonly hoursProgress = computed(() => {
    const allocated = this.node().allocatedHours;
    if (allocated <= 0) return 0;
    return Math.round((this.node().completedHours / allocated) * 100);
  });

  isLeaf(): boolean {
    return isLeafObjective(this.node());
  }

  assigneeId(): string | null {
    return this.node().taskSource?.assigneeEmployeeIds[0] ?? null;
  }
}
