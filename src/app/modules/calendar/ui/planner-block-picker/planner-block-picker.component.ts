import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerFocusItem, PlannerRangeBlockView } from '../../../work/planner/models/planner.models';

const DURATIONS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15);

function snapDuration(minutes: number): number {
  return Math.min(480, Math.max(15, Math.round(minutes / 15) * 15));
}

/** Narrow screens: plan a task, or move a block, by choosing a day, a start and a length instead of dragging
 * (2026-10-27 Planner = Calendar design, section 4.3). */
@Component({
  selector: 'app-planner-block-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="planner-block-picker" role="dialog" aria-label="Plan a time"
      class="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
      <strong class="truncate">{{ title() }}</strong>
      <label class="flex flex-col gap-1">Day
        <select data-testid="planner-picker-day" (change)="day.set($any($event.target).value)">
          @for (d of editableDates(); track d) { <option [value]="d" [selected]="d === day()">{{ d }}</option> }
        </select>
      </label>
      <label class="flex flex-col gap-1">Start
        <input data-testid="planner-picker-time" type="time" step="900" [value]="time()" (input)="time.set($any($event.target).value)" />
      </label>
      <label class="flex flex-col gap-1">Length
        <select data-testid="planner-picker-duration" (change)="minutes.set(+$any($event.target).value)">
          @for (m of durations; track m) { <option [value]="m" [selected]="m === minutes()">{{ m }} min</option> }
        </select>
      </label>
      <div class="flex justify-end gap-2">
        <button type="button" data-testid="planner-picker-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="button" data-testid="planner-picker-save" (click)="save()">Plan</button>
      </div>
    </div>
  `,
})
export class PlannerBlockPickerComponent {
  item = input.required<PlannerFocusItem | PlannerRangeBlockView>();
  editableDates = input.required<readonly string[]>();

  submitted = output<{ date: string; startMinutes: number; minutes: number }>();
  cancelled = output<void>();

  readonly durations = DURATIONS;
  readonly day = signal('');
  readonly time = signal('09:00');
  readonly minutes = signal(60);
  readonly title = computed(() => {
    const item = this.item();
    return 'taskTitle' in item ? item.taskTitle : item.title;
  });

  constructor() {
    effect(() => {
      const item = this.item();
      const length = 'plannedMinutes' in item ? item.plannedMinutes : item.remainingMinutes;
      this.minutes.set(snapDuration(length ?? 60));
    });
    effect(() => {
      const dates = this.editableDates();
      if (!dates.includes(this.day())) this.day.set(dates[0] ?? '');
    });
  }

  save(): void {
    const [h, m] = this.time().split(':').map(Number);
    this.submitted.emit({ date: this.day(), startMinutes: h * 60 + m, minutes: this.minutes() });
  }
}
