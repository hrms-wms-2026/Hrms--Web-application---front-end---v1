import { Component, computed, input, output, signal } from '@angular/core';
import { ProjectCalendarModuleDto, CalendarDateChange } from '../../models/dto/calendar.dto';
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
      [class.timeline-bar--root]="isRoot()"
      [style.--bar-color]="barColor()"
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
        @if (item().isAchieved) {
          <span class="timeline-bar__check" aria-label="Achieved">✓</span>
        } @else {
          <span class="timeline-bar__dot" aria-hidden="true"></span>
        }
        <span class="timeline-bar__title">{{ item().title }}</span>
        @if (partialBadge(); as badge) { <span class="timeline-bar__state" [title]="badge + ' tasks in milestone'" data-testid="timeline-bar-partial">{{ badge }}</span> }
        @if (saving()) { <span class="timeline-bar__state">Saving…</span> }
        @if (pendingApproval()) {
          <span class="timeline-bar__state timeline-bar__state--approval" [title]="approvalMessage()" data-testid="pending-approval">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4M12 16.5h.01M10.6 3.9 2.4 18a1.6 1.6 0 0 0 1.4 2.4h16.4a1.6 1.6 0 0 0 1.4-2.4L13.4 3.9a1.6 1.6 0 0 0-2.8 0Z" /></svg>
            <span>Approval</span>
          </span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: absolute; inset: 0; }
    /* A light "pill" bar tinted by --bar-color, close to the GitHub Projects roadmap look -
       the color lives on the border/dot/text instead of filling the whole bar solid. */
    .timeline-bar {
      position: absolute; top: 20px; height: 30px; min-width: 30px; overflow: hidden;
      border: 1.5px solid var(--bar-color); border-radius: 999px;
      background: color-mix(in srgb, var(--bar-color) 10%, var(--color-surface));
      color: var(--color-text-primary);
      box-shadow: 0 1px 2px rgb(15 23 42 / .05);
      transition: left 180ms ease, width 180ms ease, opacity 160ms ease, box-shadow 140ms ease;
    }
    .timeline-bar:hover { box-shadow: 0 3px 8px rgb(15 23 42 / .12); }
    .timeline-bar--disabled { opacity: .62; }
    .timeline-bar--saving { opacity: .76; }
    .timeline-bar--achieved { background: color-mix(in srgb, var(--bar-color) 14%, var(--color-surface)); }
    .timeline-bar--readonly { cursor: not-allowed; }
    /* The single project-root bar reads as a bold summary capsule, not another branch pill. */
    .timeline-bar--root { background: var(--bar-color); color: #fff; border-color: var(--bar-color); }
    .timeline-bar__content { display: flex; height: 100%; min-width: 0; align-items: center; gap: 7px; padding: 0 12px; font-size: 12px; font-weight: 600; }
    .timeline-bar__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timeline-bar__dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 999px; background: var(--bar-color); }
    .timeline-bar--root .timeline-bar__dot { background: #fff; }
    .timeline-bar__check { display: inline-flex; width: 16px; height: 16px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 999px; background: color-mix(in srgb, var(--bar-color) 20%, transparent); color: var(--bar-color); font-size: 10px; }
    .timeline-bar--root .timeline-bar__check { background: rgb(255 255 255 / .22); color: #fff; }
    .timeline-bar__state { margin-left: auto; flex: 0 0 auto; border-radius: 999px; padding: 3px 7px; background: color-mix(in srgb, var(--bar-color) 16%, transparent); color: var(--bar-color); font-size: 10px; font-weight: 600; }
    .timeline-bar--root .timeline-bar__state { background: rgb(255 255 255 / .18); color: #fff; }
    .timeline-bar__state--approval { display: inline-flex; align-items: center; gap: 3px; background: var(--color-warning-subtle); color: var(--color-warning-text); cursor: help; }
    .timeline-bar--root .timeline-bar__state--approval { background: rgb(255 255 255 / .3); color: #fff; }
    .timeline-bar__state--approval svg { width: 11px; height: 11px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .timeline-bar__resize { position: absolute; top: 0; z-index: 2; width: 8px; height: 100%; border: 0; background: transparent; cursor: ew-resize; }
    .timeline-bar__resize--start { left: 0; }
    .timeline-bar__resize--end { right: 0; }
    .timeline-bar__resize:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: -2px; }
    @media (prefers-reduced-motion: reduce) { .timeline-bar { transition: none; } }
  `]
})
export class ObjectiveTimelineBarComponent {
  readonly item = input.required<ProjectCalendarModuleDto>();
  readonly timelineStart = input.required<string>();
  readonly timelineEnd = input<string | null>(null);
  readonly dayWidth = input(28);
  readonly saving = input(false);
  readonly pendingApproval = input(false);
  readonly approvalMessage = input('Needs approval before this date change can be applied.');
  /** The color shared by this row's whole branch (its top-level module), used when no event overrides it. */
  readonly branchColor = input<string | null>(null);
  /** The single project-root row gets a fixed "summary bar" color instead of a branch color. */
  readonly isRoot = input(false);
  readonly dateChange = output<CalendarDateChange>();

  readonly previewDates = signal<{ startDate: string; endDate: string } | null>(null);
  private drag: DragState | null = null;

  readonly disabled = () => !this.item().canEdit || this.item().isAchieved;

  /** The event whose colour paints this bar: a whole-module link wins, else the first partial link. */
  private readonly primaryEventLink = computed(() => {
    const links = this.item().events ?? [];
    return links.find((l) => l.membership === 'whole') ?? links[0] ?? null;
  });

  readonly barColor = () => {
    if (this.item().isAchieved) return '#64748B';
    const link = this.primaryEventLink();
    if (link) return link.eventColor;
    if (this.isRoot()) return '#1E293B';
    return this.branchColor() ?? '#94A3B8';
  };

  /** "N/M" when this module is only partly in its (single) event, else null. */
  readonly partialBadge = computed(() => {
    const link = this.primaryEventLink();
    if (!link || link.membership !== 'partial') return null;
    return `${link.tasksInEventCount}/${link.taskTotalCount}`;
  });

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
