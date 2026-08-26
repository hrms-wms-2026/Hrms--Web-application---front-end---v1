import { Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { WorkTask } from '../../models/task.model';
import { toWorkTask } from '../../utils/task.mapper';

@Component({
  selector: 'app-task-clock-widget',
  standalone: true,
  template: `
    @if (hasOpenSessionMine()) {
      <button data-testid="push-button" type="button" class="task-clock-widget__button" (click)="openPushPopup()">
        Push
      </button>
      @if (pushPopupOpen()) {
        <div class="task-clock-widget__popup">
          <p data-testid="push-current-percent">Current: {{ task().progressPercent }}%</p>
          <input
            data-testid="push-percent-input"
            type="number"
            min="0"
            max="100"
            [value]="pushPercent() ?? ''"
            (input)="onPercentInput($event)"
          />
          <input
            data-testid="push-reason-input"
            type="text"
            placeholder="Optional note"
            [value]="pushReason()"
            (input)="onReasonInput($event)"
          />
          @if (pushError()) {
            <p data-testid="push-error" role="alert">{{ pushError() }}</p>
          }
          <div>
            <button data-testid="push-submit-button" type="button" [disabled]="pushSubmitting()" (click)="submitPush()">
              Submit
            </button>
            <button type="button" [disabled]="pushSubmitting()" (click)="closePushPopup()">Cancel</button>
          </div>
        </div>
      }
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
    .task-clock-widget__popup {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
      padding: 10px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
    }
    .task-clock-widget__popup input { padding: 4px 6px; }
    .task-clock-widget__popup [role="alert"] { color: var(--color-danger-text); font-size: 12px; }
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

  pushPopupOpen = signal(false);
  pushPercent = signal<number | null>(null);
  pushReason = signal('');
  pushError = signal<string | null>(null);
  pushSubmitting = signal(false);

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
    this.pushPopupOpen.set(true);
    this.pushPercent.set(null);
    this.pushReason.set('');
    this.pushError.set(null);
  }

  closePushPopup(): void {
    this.pushPopupOpen.set(false);
  }

  onPercentInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.pushPercent.set(value === '' ? null : Number(value));
  }

  onReasonInput(event: Event): void {
    this.pushReason.set((event.target as HTMLInputElement).value);
  }

  async submitPush(): Promise<void> {
    const percent = this.pushPercent();
    const current = this.task().progressPercent;
    if (percent === null || percent <= current) {
      this.pushError.set(`Percent must be greater than the current progress (${current}%).`);
      return;
    }

    this.pushSubmitting.set(true);
    this.pushError.set(null);
    try {
      const dto = await firstValueFrom(this.taskApi.push(this.task().id, {
        percent,
        reason: this.pushReason() || undefined
      }));
      this.pushed.emit(toWorkTask(dto));
      this.pushPopupOpen.set(false);
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.pushError.set(detail || 'Failed to push.');
    } finally {
      this.pushSubmitting.set(false);
    }
  }
}
