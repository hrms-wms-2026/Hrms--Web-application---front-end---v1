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
      <div data-testid="tree-explanation-panel" class="flex flex-col gap-4 p-3">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {{ kindLabel() }} Details
          </span>
        </div>

        <div class="min-w-0">
          <h2 class="text-base font-bold text-[var(--color-text-primary)] leading-tight truncate">{{ node().title }}</h2>
          @if (kind() === 'sprint' && node().status; as status) {
            <span data-testid="panel-status" class="mt-1 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{{ status }}</span>
          }
          @if (kind() === 'task' && node().status; as status) {
            <span data-testid="panel-status" class="mt-1 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{{ status }}</span>
          }
          @if (kind() === 'objective' && node().isAchieved) {
            <span data-testid="panel-achieved" class="mt-1 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Achieved</span>
          }
        </div>

        @if (node().description; as description) {
          <p data-testid="panel-description" class="text-xs leading-relaxed text-[var(--color-text-secondary)]">{{ description }}</p>
        }

        <div class="flex flex-col text-xs border-y border-[var(--color-border)] py-1">
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
            <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 p-2.5 text-center">
              <div class="text-base font-bold text-[var(--color-text-primary)]">{{ node().allocatedHours }}h</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Allocated</div>
            </div>
            <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 p-2.5 text-center">
              <div class="text-base font-bold text-[var(--color-text-primary)]">{{ node().completedHours }}h</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Completed</div>
            </div>
            <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 p-2.5 text-center">
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

        <div class="flex flex-col gap-2 pt-1">
          @if (kind() === 'objective' && node().isOwner) {
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-sub" (click)="createRequested.emit(node())">Create sub module</button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-edit" (click)="editRequested.emit(node())">Edit module</button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-members" (click)="membersRequested.emit(node())">Members</button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-task" (click)="createTaskRequested.emit(node())">Add task</button>
            @if (isLeaf()) {
              <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-sprint" (click)="createSprintRequested.emit(node())">Add sprint</button>
            }
            <button type="button" class="{{ primaryBtn }}" data-testid="panel-achieve" (click)="achieveRequested.emit(node())">
              {{ node().isAchieved ? 'Unachieve module' : 'Achieve module' }}
            </button>
          }
          @if (kind() === 'sprint' && node().isOwner) {
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-create-task" (click)="createTaskRequested.emit(node())">Create task</button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-edit" (click)="editRequested.emit(node())">Edit sprint</button>
            <button type="button" class="{{ primaryBtn }}" data-testid="panel-achieve-sprint" (click)="achieveSprintRequested.emit(node())">Achieve sprint</button>
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-complete-sprint" (click)="completeSprintRequested.emit(node())">Complete sprint</button>
          }
          @if (kind() === 'task') {
            <button type="button" class="{{ secondaryBtn }}" data-testid="panel-edit" (click)="editRequested.emit(node())">Edit task</button>
            @if (node().isOwner) {
              <button type="button" class="{{ secondaryBtn }}" data-testid="panel-delete" (click)="deleteRequested.emit(node())">Delete task</button>
            }
          }
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
  deleteRequested = output<MilestoneTreeNode>();

  readonly primaryBtn = 'w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-colors text-center';
  readonly secondaryBtn = 'w-full py-2.5 px-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-semibold text-sm transition-colors text-center';

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
