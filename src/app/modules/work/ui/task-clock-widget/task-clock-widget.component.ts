import { Component, computed, inject, input, output } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-clock-widget',
  standalone: true,
  template: `
    @if (hasOpenSessionMine()) {
      <button data-testid="push-button" type="button" class="task-clock-widget__button" (click)="openPushPopup()">
        Push
      </button>
    } @else {
      <button
        data-testid="clock-in-button"
        type="button"
        class="task-clock-widget__button"
        [disabled]="clockInDisabled()"
        [title]="clockInDisabledReason()"
        (click)="onClockIn()"
      >
        Clock In
      </button>
    }
  `,
  styles: [`
    .task-clock-widget__button {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 12px;
      background: var(--color-surface);
      color: var(--color-text-primary);
    }
    .task-clock-widget__button:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class TaskClockWidgetComponent {
  private readonly taskApi = inject(TaskApiService);

  task = input.required<WorkTask>();
  hasOpenSessionMine = input(false);
  hasOpenSessionOtherEmployee = input(false);
  isAssignee = input.required<boolean>();
  clockedIn = output<void>();
  pushed = output<WorkTask>();

  isLockedAt100 = computed(() => this.task().progressPercent === 100);

  clockInDisabled = computed(() =>
    this.isLockedAt100() || this.hasOpenSessionOtherEmployee() || !this.isAssignee()
  );

  clockInDisabledReason = computed(() => {
    if (this.isLockedAt100()) return 'This task is complete - reduce its percentage before clocking in again.';
    if (this.hasOpenSessionOtherEmployee()) return 'Another teammate has this task in progress.';
    if (!this.isAssignee()) return 'Only an assignee of this task can clock in.';
    return '';
  });

  async onClockIn(): Promise<void> {
    await firstValueFrom(this.taskApi.clockIn(this.task().id));
    this.clockedIn.emit();
  }

  openPushPopup(): void {
    // Task 2 of this Part implements the popup itself.
  }
}
