import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CalendarEventLegendComponent } from '../../ui/calendar-event-legend/calendar-event-legend.component';
import { CalendarEventModalComponent } from '../../ui/calendar-event-modal/calendar-event-modal.component';
import { ObjectiveTimelineBarComponent } from '../../ui/objective-timeline-bar/objective-timeline-bar.component';
import {
  CalendarDateChange,
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';
import { ProjectCalendarStore } from '../../state/project-calendar.store';
import { addCalendarDays, calendarDayDifference, calendarRange, parseCalendarDate, rangeToPercent } from '../../utils/calendar-date.utils';
import { buildCalendarTreeOrder } from '../../utils/calendar-tree.utils';

@Component({
  selector: 'app-project-calendar',
  standalone: true,
  imports: [ObjectiveTimelineBarComponent, CalendarEventModalComponent, CalendarEventLegendComponent],
  template: `
    <section class="project-calendar" data-testid="project-calendar">
      <header class="project-calendar__header">
        <div class="project-calendar__heading">
          <p class="project-calendar__eyebrow">Project calendar</p>
          <h1 class="project-calendar__title">Objective timeline</h1>
          <p class="project-calendar__description">Drag an editable bar to shift it, or use its edges to resize the date range.</p>
        </div>
        <div class="project-calendar__actions">
          <div class="project-calendar__zoom" data-testid="zoom-controls">
            <button type="button" class="project-calendar__zoom-step" aria-label="Zoom out" [disabled]="isAtMinZoom()" (click)="zoomOut()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8 11h6" /></svg>
            </button>
            <button type="button" class="project-calendar__zoom-fit" data-testid="fit-to-screen" (click)="fitToScreen()">Fit</button>
            <button type="button" class="project-calendar__zoom-step" aria-label="Zoom in" [disabled]="isAtMaxZoom()" (click)="zoomIn()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>
            </button>
          </div>
          <button type="button" class="project-calendar__create" [disabled]="store.loading() || !store.modules().length" (click)="openCreateEvent()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span>Create event</span>
          </button>
        </div>
      </header>

      @if (store.error()) {
        <div class="project-calendar__error" role="alert">{{ store.error() }}</div>
      }
      @if (store.loading()) {
        <div class="project-calendar__empty">Loading calendar…</div>
      } @else if (!store.modules().length) {
        <div class="project-calendar__empty">No objectives are available for this project.</div>
      } @else {
        <div class="project-calendar__layout">
          <div class="project-calendar__timeline-scroll" #scrollContainer>
            <div class="project-calendar__timeline" [style.minWidth.px]="timelineWidth() + LABEL_WIDTH">
              <div class="project-calendar__grid project-calendar__grid--header" [style.gridTemplateColumns]="LABEL_WIDTH + 'px ' + timelineWidth() + 'px'">
                <div class="project-calendar__label-header">Objective</div>
                <div class="project-calendar__date-header" [style.width.px]="timelineWidth()">
                  @for (day of dateMarkers(); track day) {
                    <div class="project-calendar__date-marker" [style.left.px]="dayIndex(day) * dayWidth()" [style.width.px]="markerBoxWidth()">{{ formatDayLabel(day) }}</div>
                  }
                </div>
              </div>
              @if (bandRects().length) {
                <div class="project-calendar__bands" [style.left.px]="LABEL_WIDTH" [style.width.px]="timelineWidth()">
                  @for (band of bandRects(); track band.eventId) {
                    <div
                      class="project-calendar__band"
                      data-testid="calendar-event-band"
                      [style.left]="band.leftPct + '%'"
                      [style.width]="band.widthPct + '%'"
                      [style.backgroundColor]="band.tint"
                      [style.borderColor]="band.color"
                      [title]="band.name + '  ' + band.startDate + ' → ' + band.endDate"
                    >
                      <span class="project-calendar__band-label" [style.color]="band.color">{{ band.name }}</span>
                    </div>
                  }
                </div>
              }
              @for (row of rows(); track row.item.objectiveId) {
                <div class="project-calendar__grid project-calendar__grid--row" [style.gridTemplateColumns]="LABEL_WIDTH + 'px ' + timelineWidth() + 'px'" [attr.data-testid]="'calendar-row-' + row.item.objectiveId">
                  <div class="project-calendar__objective" [style.paddingLeft.px]="12 + row.depth * 18">
                    <div class="project-calendar__objective-title" [title]="row.item.title">
                      <svg class="project-calendar__folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" /><path d="M2.5 9h18" /></svg>
                      <span>{{ row.item.title }}</span>
                    </div>
                    <div class="project-calendar__objective-dates">{{ formatDateRange(row.item.startDate, row.item.endDate) }}</div>
                  </div>
                  <div class="project-calendar__track" [style.width.px]="timelineWidth()">
                    <div class="project-calendar__grid-background" [style.background]="gridBackground()"></div>
                    <app-objective-timeline-bar
                      [item]="row.item"
                      [timelineStart]="timelineStart()"
                      [timelineEnd]="timelineEnd()"
                      [dayWidth]="dayWidth()"
                      [saving]="store.saving()"
                      [pendingApproval]="store.pendingSet().has(row.item.objectiveId)"
                      [approvalMessage]="store.approvalMessages()[row.item.objectiveId] || 'Needs approval before this date change can be applied.'"
                      (dateChange)="saveDates($event)"
                    />
                  </div>
                </div>
              }
              @if (todayVisible()) {
                <div class="project-calendar__today-line" data-testid="today-marker" [style.left.px]="LABEL_WIDTH + todayOffset()">
                  <span class="project-calendar__today-label">Today</span>
                </div>
              }
            </div>
          </div>
          <app-calendar-event-legend [events]="store.activeEvents()" (edit)="openEditEvent($event)" (close)="closeEvent($event)" />
        </div>
      }
    </section>

    @if (modalOpen()) {
      <app-calendar-event-modal
        [event]="editingEvent()"
        [modules]="store.modules()"
        (cancel)="modalOpen.set(false)"
        (save)="saveEvent($event)"
      />
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .project-calendar { display: flex; min-width: 0; flex-direction: column; gap: 16px; padding: 8px 0 24px; color: var(--color-text-primary); }
    .project-calendar__header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; }
    .project-calendar__heading { min-width: 220px; }
    .project-calendar__eyebrow { margin: 0 0 4px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
    .project-calendar__title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -.02em; }
    .project-calendar__description { margin: 5px 0 0; color: var(--color-text-secondary); font-size: 13px; }
    .project-calendar__actions { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: flex-end; gap: 16px; }
    .project-calendar__zoom { display: flex; align-items: center; gap: 2px; height: 44px; border: 1px solid var(--color-border); border-radius: 9px; padding: 0 6px; background: var(--color-surface); }
    .project-calendar__zoom-step { display: flex; height: 30px; width: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
    .project-calendar__zoom-step:hover:not(:disabled) { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .project-calendar__zoom-step:disabled { cursor: not-allowed; opacity: .35; }
    .project-calendar__zoom-step:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .project-calendar__zoom-step svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__zoom-fit { height: 30px; flex: 0 0 auto; border: 0; border-left: 1px solid var(--color-border); border-right: 1px solid var(--color-border); margin: 0 2px; padding: 0 10px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
    .project-calendar__zoom-fit:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .project-calendar__zoom-fit:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .project-calendar__create { display: inline-flex; flex: 0 0 auto; height: 44px; align-items: center; gap: 7px; border: 0; border-radius: 9px; padding: 0 14px; background: var(--color-accent); color: var(--color-accent-contrast, #fff); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 5px 12px color-mix(in srgb, var(--color-accent) 22%, transparent); transition: filter 160ms ease, transform 160ms ease; }
    .project-calendar__create:hover:not(:disabled) { filter: brightness(.96); transform: translateY(-1px); }
    .project-calendar__create:disabled { cursor: not-allowed; opacity: .5; }
    .project-calendar__create:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .project-calendar__create svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__error { border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent); border-radius: 9px; padding: 11px 13px; background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface)); color: var(--color-danger); font-size: 13px; }
    .project-calendar__empty { border: 1px dashed var(--color-border); border-radius: 11px; padding: 42px 20px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .project-calendar__layout { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) 220px; align-items: start; gap: 14px; }
    .project-calendar__timeline-scroll { min-width: 0; overflow-x: auto; border: 1px solid var(--color-border); border-radius: 11px; background: var(--color-surface); }
    .project-calendar__timeline { position: relative; min-height: 100%; }
    .project-calendar__bands { position: absolute; top: 54px; bottom: 0; z-index: 1; pointer-events: none; }
    .project-calendar__band { position: absolute; top: 0; bottom: 0; border-left: 1.5px solid; border-right: 1.5px solid; border-radius: 4px; }
    .project-calendar__band-label { position: absolute; top: 2px; left: 6px; font-size: 10px; font-weight: 600; white-space: nowrap; }
    .project-calendar__today-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--color-danger); z-index: 5; pointer-events: none; }
    .project-calendar__today-label { position: absolute; top: -17px; left: 50%; transform: translateX(-50%); border-radius: 4px; background: var(--color-danger); padding: 1px 5px; color: #fff; font-size: 9px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; white-space: nowrap; }
    .project-calendar__grid { display: grid; }
    .project-calendar__grid--header { min-height: 54px; border-bottom: 1px solid var(--color-border); }
    .project-calendar__grid--row { min-height: 76px; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent); }
    .project-calendar__grid--row:last-child { border-bottom: 0; }
    .project-calendar__label-header { display: flex; align-items: center; padding: 0 14px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
    .project-calendar__date-header { position: relative; overflow: hidden; border-left: 1px solid var(--color-border); background: var(--color-surface-secondary); }
    .project-calendar__date-marker { position: absolute; top: 0; bottom: 0; display: flex; overflow: hidden; align-items: center; padding-left: 8px; border-left: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent); color: var(--color-text-secondary); font-size: 10px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
    .project-calendar__objective { min-width: 0; overflow: hidden; padding: 12px 10px 10px 0; }
    .project-calendar__objective-title { display: flex; min-width: 0; align-items: center; gap: 7px; overflow: hidden; font-size: 13px; font-weight: 600; line-height: 1.35; }
    .project-calendar__objective-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .project-calendar__folder-icon { width: 16px; height: 16px; flex: 0 0 auto; fill: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); stroke: var(--color-accent); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__objective-dates { margin: 5px 0 0 23px; color: var(--color-text-secondary); font-size: 11px; white-space: nowrap; }
    .project-calendar__track { position: relative; min-width: 0; overflow: hidden; border-left: 1px solid var(--color-border); }
    .project-calendar__grid-background { position: absolute; inset: 0; opacity: .5; }
    @media (max-width: 900px) { .project-calendar__layout { grid-template-columns: minmax(0, 1fr); } .project-calendar__actions { width: 100%; justify-content: flex-start; } }
    @media (max-width: 560px) { .project-calendar__actions { gap: 10px; } .project-calendar__create { flex: 1 1 150px; justify-content: center; } }
  `]
})
export class ProjectCalendarComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(ProjectCalendarStore);
  private readonly route = inject(ActivatedRoute);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private resizeObserver?: ResizeObserver;
  readonly LABEL_WIDTH = 240;
  private readonly MIN_FIT_DAY_WIDTH = 3;
  private readonly MAX_DAY_WIDTH = 160;
  private readonly ZOOM_STEP = 1.3;
  private readonly MARKER_TARGET_PX = 60;
  readonly today = new Date().toISOString().slice(0, 10);
  readonly containerWidth = signal(0);
  readonly modalOpen = signal(false);
  readonly editingEvent = signal<CalendarEventDto | null>(null);
  readonly projectId = signal<string | null>(null);
  // The user-requested zoom level (px/day). Always clamped between the current
  // fit-to-screen floor and MAX_DAY_WIDTH by dayWidth() below - no separate "views"
  // that hide part of the range, just one continuous chart you zoom and scroll.
  readonly zoomDayWidth = signal(32);

  readonly timelineStart = computed(() => {
    const dates = this.store.modules().map((item) => item.startDate).filter(Boolean).sort();
    return dates[0] ?? new Date().toISOString().slice(0, 10);
  });
  readonly timelineEnd = computed(() => {
    const dates = this.store.modules().map((item) => item.endDate).filter(Boolean).sort();
    return dates.at(-1) ?? addCalendarDays(this.timelineStart(), 30);
  });
  readonly days = computed(() => calendarRange(this.timelineStart(), this.timelineEnd()));
  // The most-zoomed-out width that still fits the whole project into the visible
  // container with no horizontal scroll - the floor zoomOut()/dayWidth() clamp to,
  // and what the "Fit" button jumps straight to.
  readonly fitDayWidth = computed(() => {
    const totalDays = Math.max(1, calendarDayDifference(this.timelineStart(), this.timelineEnd()) + 1);
    const available = this.containerWidth() - this.LABEL_WIDTH;
    return available > 0 ? Math.max(this.MIN_FIT_DAY_WIDTH, available / totalDays) : this.MIN_FIT_DAY_WIDTH;
  });
  readonly dayWidth = computed(() => Math.min(this.MAX_DAY_WIDTH, Math.max(this.fitDayWidth(), this.zoomDayWidth())));
  readonly isAtMinZoom = computed(() => this.dayWidth() <= this.fitDayWidth() + 0.01);
  readonly isAtMaxZoom = computed(() => this.dayWidth() >= this.MAX_DAY_WIDTH);
  // Ticks keep roughly the same on-screen gap at any zoom level (the number of days
  // each tick represents grows/shrinks instead) - "the space between markers should
  // always be the same amount" - rather than a fixed day-step that would crowd
  // together when zoomed out or spread out pointlessly when zoomed in.
  readonly markerStep = computed(() => Math.max(1, Math.round(this.MARKER_TARGET_PX / this.dayWidth())));
  readonly dateMarkers = computed(() => {
    const step = this.markerStep();
    return this.days().filter((_, index) => index % step === 0);
  });
  readonly timelineWidth = computed(() => Math.max(1, this.days().length) * this.dayWidth());
  // Caps each ruler label's box to the gap before the next tick, so dense ticks at
  // high zoom clip with an ellipsis instead of visually overlapping their neighbor.
  readonly markerBoxWidth = computed(() => Math.max(1, this.markerStep() * this.dayWidth()));
  readonly rows = computed(() => buildCalendarTreeOrder(this.store.modules()));
  readonly bandRects = computed(() => {
    const windowStart = this.timelineStart();
    const windowEnd = this.timelineEnd();
    return this.store.bands().map((band) => {
      const { leftPct, widthPct } = rangeToPercent(band.startDate, band.endDate, windowStart, windowEnd);
      return {
        eventId: band.eventId,
        name: band.name,
        color: band.color,
        tint: `color-mix(in srgb, ${band.color} 12%, transparent)`,
        startDate: band.startDate,
        endDate: band.endDate,
        leftPct,
        widthPct
      };
    });
  });
  readonly todayVisible = computed(() => this.today >= this.timelineStart() && this.today <= this.timelineEnd());
  readonly todayOffset = computed(() => this.dayIndex(this.today) * this.dayWidth());

  ngOnInit(): void {
    const id = this.route.snapshot.parent?.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
    if (id) {
      this.projectId.set(id);
      void this.store.load(id);
    }
  }

  ngAfterViewInit(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.containerWidth.set(el.clientWidth);
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) this.containerWidth.set(width);
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  zoomIn(): void {
    this.zoomDayWidth.update((width) => Math.min(this.MAX_DAY_WIDTH, Math.max(this.fitDayWidth(), width) * this.ZOOM_STEP));
  }

  zoomOut(): void {
    this.zoomDayWidth.update((width) => Math.max(this.fitDayWidth(), Math.min(this.MAX_DAY_WIDTH, width) / this.ZOOM_STEP));
  }

  fitToScreen(): void {
    this.zoomDayWidth.set(this.fitDayWidth());
  }

  dayIndex(day: string): number {
    return calendarDayDifference(this.timelineStart(), day);
  }

  formatDayLabel(day: string): string {
    const date = parseCalendarDate(day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  formatDateRange(start: string, end: string): string {
    return `${start} → ${end}`;
  }

  gridBackground(): string {
    const width = this.dayWidth();
    return `repeating-linear-gradient(to right, transparent 0, transparent ${width - 1}px, var(--color-border) ${width - 1}px, var(--color-border) ${width}px)`;
  }

  async saveDates(change: CalendarDateChange): Promise<void> { await this.store.saveDates(change); }

  openCreateEvent(): void {
    this.editingEvent.set(null);
    this.modalOpen.set(true);
  }

  openEditEvent(eventId: string): void {
    const event = this.store.events().find((e) => e.id === eventId) ?? null;
    this.editingEvent.set(event);
    this.modalOpen.set(true);
  }

  async saveEvent(payload: CreateCalendarEventRequestDto | UpdateCalendarEventRequestDto): Promise<void> {
    const editing = this.editingEvent();
    const success = editing
      ? await this.store.updateEvent(editing.id, payload)
      : await this.store.createEvent(payload as CreateCalendarEventRequestDto);
    if (success) this.modalOpen.set(false);
  }

  async closeEvent(id: string): Promise<void> { await this.store.closeEvent(id); }
}
