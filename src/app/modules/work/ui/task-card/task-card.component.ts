import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';

@Component({
  selector: 'app-task-card',
  standalone: true,
    imports: [DatePipe, TaskClockWidgetComponent],

  template: `
    <div class="task-card" [attr.data-testid]="'task-card-' + task().id" (click)="viewed.emit(task())">
      <div class="task-card__header">
        <span class="task-card__short-id">{{ task().shortId }}</span>
        <button type="button" class="task-card__view-btn" aria-label="View task" title="View task" (click)="viewed.emit(task()); $event.stopPropagation()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></svg></button>
      </div>
      <p class="task-card__title">{{ task().title }}</p>

      @if (assigneeNames().length > 0) {
        <p class="task-card__assignees"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4.5a4 4 0 0 1 0 7.5M19 21a6 6 0 0 0-3-5.2" /></svg><span>{{ assigneeNames().join(', ') }}</span></p>
      }

      <div class="task-card__meta">
        <span class="task-card__priority" [attr.data-priority]="task().priority">{{ task().priority }}</span>
        @if (task().dueDate) {
          <span class="task-card__due-date"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg><span>{{ task().dueDate | date: 'MMM d' }}</span></span>
        }
        @if (task().estimatedHours) {
          <span class="task-card__hours"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg><span>{{ task().estimatedHours }}h</span></span>
        }
        @if (task().activeEventName) {
          <span class="task-card__event" data-testid="task-event-chip" [title]="'In milestone: ' + task().activeEventName">{{ task().activeEventName }}</span>
        }
      </div>

      <div class="task-card__footer">
        <span class="task-card__status" data-testid="task-card-status">{{ statusName() }}</span>
        @if (isAssignee()) {
          <div class="task-card__clock" (click)="$event.stopPropagation()">
            <app-task-clock-widget
              [task]="task()"
              [isAssignee]="isAssignee()"
              [compact]="true"
              [hasOpenSessionMine]="hasOpenSessionMine()"
              [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
              (clockedIn)="taskChanged.emit()"
              (pushed)="taskChanged.emit()"
            />
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .task-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 12px 14px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
      transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    }
    .task-card:hover {
      border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border));
      box-shadow: 0 5px 14px rgb(15 23 42 / 0.08);
      transform: translateY(-1px);
    }
    .task-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .task-card__view-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: var(--color-accent);
      background: transparent;
      border: 0;
      border-radius: 7px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: background-color 160ms ease, color 160ms ease;
    }
    .task-card__view-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .task-card__view-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .task-card__view-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .task-card__short-id { font-size: 11px; color: var(--color-text-secondary); }
    .task-card__title { margin: 5px 0 7px; font-size: 13px; font-weight: 500; color: var(--color-text-primary); line-height: 1.4; }
    .task-card__assignees { display: flex; align-items: center; gap: 5px; margin: 0 0 7px; font-size: 11px; color: var(--color-text-secondary); }
    .task-card__assignees svg, .task-card__due-date svg, .task-card__hours svg { width: 13px; height: 13px; flex: 0 0 auto; fill: none; stroke: var(--color-accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .task-card__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 11px; color: var(--color-text-secondary); margin-bottom: 8px; }
    .task-card__due-date, .task-card__hours { display: inline-flex; align-items: center; gap: 4px; }
    .task-card__priority[data-priority="critical"],
    .task-card__priority[data-priority="high"] { color: var(--color-danger); }
    .task-card__event { overflow: hidden; max-width: 120px; border-radius: 999px; background: var(--color-surface-secondary); padding: 1px 8px; color: var(--color-text-secondary); font-size: 10px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .task-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
    .task-card__clock { min-width: 0; margin-left: auto; }
    .task-card__status { display: inline-flex; width: fit-content; flex: 0 0 auto; border-radius: 999px; background: var(--color-surface-secondary); padding: 3px 8px; font-size: 10px; font-weight: 500; color: var(--color-text-secondary); }
  `]
})
export class TaskCardComponent {
  task = input.required<WorkTask>();
  statuses = input<readonly TaskStatusColumn[]>([]);
  employeeNames = input<Record<string, string>>({});
  currentEmployeeId = input('');

  viewed = output<WorkTask>();
  taskChanged = output<void>();

    protected readonly isAssignee = computed(() => this.task().assigneeEmployeeIds.includes(this.currentEmployeeId()));
  protected readonly hasOpenSessionMine = computed(() =>
    this.task().openClockSessionEmployeeId === this.currentEmployeeId() && this.currentEmployeeId() !== ''
  );
  protected readonly hasOpenSessionOtherEmployee = computed(() => {
    const openBy = this.task().openClockSessionEmployeeId;
    return openBy !== null && openBy !== this.currentEmployeeId();
  });

  protected readonly statusName = computed(() =>

    this.statuses().find((s) => s.id === this.task().statusId)?.name ?? this.task().statusId
  );

  protected readonly assigneeNames = computed(() => {
    const names = this.employeeNames();
    return this.task().assigneeEmployeeIds.map((id) => names[id] ?? 'Unknown employee');
  });
}
