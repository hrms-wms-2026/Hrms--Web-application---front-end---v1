import { Component, input, output, signal } from '@angular/core';
import { ProjectCalendarItemDto, CalendarDateChange } from '../../models/dto/calendar.dto';
import { addCalendarDays, calendarDayDifference } from '../../utils/calendar-date.utils';

interface DragState {
  mode: 'move' | 'start' | 'end';
  pointerX: number;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-objective-timeline-bar',
  standalone: true,
  template: `
    <div
      class="timeline-bar"
      [class.timeline-bar--disabled]="disabled() && !item().isAchieved"
      [class.timeline-bar--saving]="saving()"
      [class.timeline-bar--achieved]="item().isAchieved"
      [class.timeline-bar--readonly]="disabled()"
      [style.backgroundColor]="barColor()"
      [style.left.px]="left()"
      [style.width.px]="width()"
      [attr.aria-label]="item().title"
      [attr.data-testid]="'timeline-bar-' + item().objectiveId"
      (pointerdown)="startDrag($event, 'move')"
    >
      @if (!disabled()) {
        <button type="button" class="timeline-bar__resize timeline-bar__resize--start" aria-label="Resize start" (pointerdown)="startDrag($event, 'start')"></button>
        <button type="button" class="timeline-bar__resize timeline-bar__resize--end" aria-label="Resize end" (pointerdown)="startDrag($event, 'end')"></button>
      }
      <div class="timeline-bar__content">
        @if (item().isAchieved) { <span class="timeline-bar__check" aria-label="Achieved">✓</span> }
        <span class="timeline-bar__title">{{ item().title }}</span>
        @if (saving()) { <span class="timeline-bar__state">Saving…</span> }
        @if (pendingApproval()) { <span class="timeline-bar__state timeline-bar__state--approval" title="Needs approval">Approval</span> }
      </div>
    </div>
    @if (pendingApproval()) {
      <div
        class="absolute top-12 mt-1 whitespace-nowrap text-[11px] text-[var(--color-warning)]"
        [style.left.px]="left()"
        data-testid="pending-approval"
      >{{ approvalMessage() }}</div>
    }
  `,
  styles: [`
    :host { display: block; position: absolute; inset: 0; }
    .timeline-bar { position: absolute; top: 14px; height: 42px; min-width: 30px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent); border-radius: 9px; color: #fff; box-shadow: 0 4px 10px rgb(15 23 42 / .12); transition: left 180ms ease, width 180ms ease, opacity 160ms ease, filter 160ms ease; }
    .timeline-bar:hover { filter: brightness(.97); }
    .timeline-bar--disabled { opacity: .62; }
    .timeline-bar--saving { opacity: .76; }
    .timeline-bar--achieved { border-color: color-mix(in srgb, var(--color-text-secondary) 55%, transparent); }
    .timeline-bar--readonly { cursor: not-allowed; }
    .timeline-bar__content { display: flex; height: 100%; min-width: 0; align-items: center; gap: 7px; padding: 0 12px; font-size: 12px; font-weight: 650; }
    .timeline-bar__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-bar__check { display: inline-flex; width: 17px; height: 17px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 999px; background: rgb(255 255 255 / .22); font-size: 11px; }
    .timeline-bar__state { margin-left: auto; flex: 0 0 auto; border-radius: 999px; padding: 3px 7px; background: rgb(255 255 255 / .18); font-size: 10px; font-weight: 600; }
    .timeline-bar__state--approval { background: rgb(255 255 255 / .25); }
    .timeline-bar__resize { position: absolute; top: 0; z-index: 2; width: 8px; height: 100%; border: 0; background: transparent; cursor: ew-resize; }
    .timeline-bar__resize--start { left: 0; }
    .timeline-bar__resize--end { right: 0; }
    .timeline-bar__resize:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
    .timeline-bar + [data-testid="pending-approval"] { position: absolute; top: 60px; margin-top: 4px; white-space: nowrap; color: var(--color-warning); font-size: 11px; }
    @media (prefers-reduced-motion: reduce) { .timeline-bar { transition: none; } }
  `]
})
export class ObjectiveTimelineBarComponent {
  readonly item = input.required<ProjectCalendarItemDto>();
  readonly timelineStart = input.required<string>();
  readonly timelineEnd = input<string | null>(null);
  readonly dayWidth = input(28);
  readonly saving = input(false);
  readonly pendingApproval = input(false);
  readonly approvalMessage = input('Needs approval before this date change can be applied.');
  readonly dateChange = output<CalendarDateChange>();

  readonly previewDates = signal<{ startDate: string; endDate: string } | null>(null);
  private drag: DragState | null = null;

  readonly disabled = () => !this.item().canEdit || this.item().isAchieved;
  readonly barColor = () => {
    if (this.disabled()) return this.item().isAchieved ? '#64748B' : '#94A3B8';
    return this.item().calendarEventColor || 'var(--color-accent)';
  };

  left(): number {
    const dates = this.previewDates() ?? this.item();
    const startDate = this.clampDate(dates.startDate, this.timelineStart(), this.timelineEnd());
    return Math.max(0, calendarDayDifference(this.timelineStart(), startDate) * this.dayWidth());
  }

  width(): number {
    const dates = this.previewDates() ?? this.item();
    const startDate = this.clampDate(dates.startDate, this.timelineStart(), this.timelineEnd());
    const endDate = this.clampDate(dates.endDate, this.timelineStart(), this.timelineEnd());
    return Math.max(this.dayWidth(), (calendarDayDifference(startDate, endDate) + 1) * this.dayWidth());
  }

  private clampDate(value: string, min: string, max: string | null): string {
    if (value < min) return min;
    if (max && value > max) return max;
    return value;
  }

  startDrag(event: PointerEvent, mode: DragState['mode']): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.drag = { mode, pointerX: event.clientX, startDate: this.item().startDate, endDate: this.item().endDate };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.moveDrag);
    window.addEventListener('pointerup', this.finishDrag, { once: true });
  }

  private moveDrag = (event: PointerEvent): void => {
    if (!this.drag) return;
    const delta = Math.round((event.clientX - this.drag.pointerX) / this.dayWidth());
    let startDate = this.drag.startDate;
    let endDate = this.drag.endDate;
    if (this.drag.mode === 'move') {
      startDate = addCalendarDays(this.drag.startDate, delta);
      endDate = addCalendarDays(this.drag.endDate, delta);
    } else if (this.drag.mode === 'start') {
      startDate = addCalendarDays(this.drag.startDate, delta);
      if (calendarDayDifference(startDate, endDate) < 0) startDate = endDate;
    } else {
      endDate = addCalendarDays(this.drag.endDate, delta);
      if (calendarDayDifference(startDate, endDate) < 0) endDate = startDate;
    }
    this.previewDates.set({ startDate, endDate });
  };

  private finishDrag = (): void => {
    window.removeEventListener('pointermove', this.moveDrag);
    const preview = this.previewDates();
    this.drag = null;
    this.previewDates.set(null);
    if (!preview || (preview.startDate === this.item().startDate && preview.endDate === this.item().endDate)) return;
    const change: CalendarDateChange = { objectiveId: this.item().objectiveId, ...preview };
    this.dateChange.emit(change);
  };
}
