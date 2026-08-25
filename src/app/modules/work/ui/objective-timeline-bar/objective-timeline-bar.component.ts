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
      class="absolute top-3 h-9 rounded-md border border-black/10 transition-opacity"
      [class.cursor-not-allowed]="disabled()"
      [class.opacity-55]="disabled() && !item().isAchieved"
      [class.opacity-75]="saving()"
      [style.backgroundColor]="barColor()"
      [style.left.px]="left()"
      [style.width.px]="width()"
      [attr.aria-label]="item().title"
      [attr.data-testid]="'timeline-bar-' + item().objectiveId"
      (pointerdown)="startDrag($event, 'move')"
    >
      @if (!disabled()) {
        <button type="button" class="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-transparent" aria-label="Resize start" (pointerdown)="startDrag($event, 'start')"></button>
        <button type="button" class="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-transparent" aria-label="Resize end" (pointerdown)="startDrag($event, 'end')"></button>
      }
      <div class="flex h-full items-center gap-1 overflow-hidden px-3 text-xs font-semibold text-white">
        @if (item().isAchieved) { <span aria-label="Achieved">✓</span> }
        <span class="truncate">{{ item().title }}</span>
        @if (saving()) { <span class="ml-auto text-[10px]">Saving…</span> }
        @if (pendingApproval()) { <span class="ml-auto rounded bg-white/25 px-1 text-[10px]" title="Needs approval">Approval</span> }
      </div>
    </div>
    @if (pendingApproval()) {
      <div
        class="absolute top-12 mt-1 whitespace-nowrap text-[11px] text-[var(--color-warning)]"
        [style.left.px]="left()"
        data-testid="pending-approval"
      >{{ approvalMessage() }}</div>
    }
  `
})
export class ObjectiveTimelineBarComponent {
  readonly item = input.required<ProjectCalendarItemDto>();
  readonly timelineStart = input.required<string>();
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
    return Math.max(0, calendarDayDifference(this.timelineStart(), dates.startDate) * this.dayWidth());
  }

  width(): number {
    const dates = this.previewDates() ?? this.item();
    return Math.max(this.dayWidth(), (calendarDayDifference(dates.startDate, dates.endDate) + 1) * this.dayWidth());
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
