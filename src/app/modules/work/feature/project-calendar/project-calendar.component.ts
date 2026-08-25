import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CalendarEventLegendComponent } from '../../ui/calendar-event-legend/calendar-event-legend.component';
import { CalendarEventModalComponent } from '../../ui/calendar-event-modal/calendar-event-modal.component';
import { ObjectiveTimelineBarComponent } from '../../ui/objective-timeline-bar/objective-timeline-bar.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import {
  CalendarDateChange,
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';
import { ProjectCalendarStore } from '../../state/project-calendar.store';
import { addCalendarDays, addCalendarMonths, calendarDayDifference, calendarRange, parseCalendarDate } from '../../utils/calendar-date.utils';
import { buildCalendarTreeOrder } from '../../utils/calendar-tree.utils';

type CalendarView = 'default' | 'week' | 'month' | 'year';

function startOfMonth(value: string): string {
  const date = parseCalendarDate(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function endOfMonth(monthStart: string): string {
  return addCalendarDays(addCalendarMonths(monthStart, 1), -1);
}

/**
 * The visible [start, end] date range for a given view + anchor. week/month/year are
 * zoomed-in periods that page independently of the objectives' own date span - the
 * anchor moves via previousPeriod()/nextPeriod() rather than being fixed to the
 * project's earliest date, otherwise most objectives would render entirely outside
 * the visible (overflow: hidden) track and appear to vanish.
 */
function periodRangeFor(
  view: CalendarView, anchor: string, fallbackStart: string, fallbackEnd: string
): { start: string; end: string } {
  switch (view) {
    case 'week':
      return { start: anchor, end: addCalendarDays(anchor, 6) };
    case 'month': {
      const start = startOfMonth(anchor);
      return { start, end: endOfMonth(start) };
    }
    case 'year': {
      const year = parseCalendarDate(anchor).getUTCFullYear();
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    default:
      return { start: fallbackStart, end: fallbackEnd };
  }
}

@Component({
  selector: 'app-project-calendar',
  standalone: true,
  imports: [ObjectiveTimelineBarComponent, CalendarEventModalComponent, CalendarEventLegendComponent, WorkDropdownComponent],
  template: `
    <section class="project-calendar" data-testid="project-calendar">
      <header class="project-calendar__header">
        <div class="project-calendar__heading">
          <p class="project-calendar__eyebrow">Project calendar</p>
          <h1 class="project-calendar__title">Objective timeline</h1>
          <p class="project-calendar__description">Drag an editable bar to shift it, or use its edges to resize the date range.</p>
        </div>
        <div class="project-calendar__actions">
          @if (calendarView() !== 'default') {
            <div class="project-calendar__period-nav" data-testid="period-nav">
              <button type="button" class="project-calendar__period-step" aria-label="Previous period" (click)="previousPeriod()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
              </button>
              <span class="project-calendar__period-label" data-testid="period-label">{{ viewRangeLabel() }}</span>
              <button type="button" class="project-calendar__period-step" aria-label="Next period" (click)="nextPeriod()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </button>
            </div>
          }
          <app-work-dropdown
            [options]="viewOptions"
            [selected]="calendarView()"
            fieldLabel="View"
            accessibleLabel="Calendar view"
            leadingIcon="filter"
            (selectionChanged)="setCalendarView($event)"
          />
          <button type="button" class="project-calendar__create" [disabled]="store.loading() || !store.items().length" (click)="openCreateEvent()">
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
      } @else if (!store.items().length) {
        <div class="project-calendar__empty">No objectives are available for this project.</div>
      } @else {
        <div class="project-calendar__layout">
          <div class="project-calendar__timeline-scroll">
            <div class="project-calendar__timeline" [style.minWidth.px]="timelineWidth() + LABEL_WIDTH">
              <div class="project-calendar__grid project-calendar__grid--header" [style.gridTemplateColumns]="LABEL_WIDTH + 'px ' + timelineWidth() + 'px'">
                <div class="project-calendar__label-header">Objective</div>
                <div class="project-calendar__date-header" [style.width.px]="timelineWidth()">
                  @for (day of dateMarkers(); track day) {
                    <div class="project-calendar__date-marker" [style.left.px]="dayIndex(day) * dayWidth()">{{ formatDayLabel(day) }}</div>
                  }
                </div>
              </div>
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
                      [timelineStart]="visibleTimelineStart()"
                      [dayWidth]="dayWidth()"
                      [saving]="store.saving()"
                      [pendingApproval]="store.pendingSet().has(row.item.objectiveId)"
                      [approvalMessage]="store.approvalMessages()[row.item.objectiveId] || 'Needs approval before this date change can be applied.'"
                      (dateChange)="saveDates($event)"
                    />
                  </div>
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
        [items]="store.items()"
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
    .project-calendar__actions { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: flex-end; gap: 9px; }
    .project-calendar__actions app-work-dropdown { width: 164px; }
    .project-calendar__period-nav { display: flex; align-items: center; gap: 6px; height: 44px; border: 1px solid var(--color-border); border-radius: 9px; padding: 0 6px; background: var(--color-surface); }
    .project-calendar__period-step { display: flex; height: 30px; width: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
    .project-calendar__period-step:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .project-calendar__period-step:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .project-calendar__period-step svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__period-label { min-width: 120px; color: var(--color-text-primary); font-size: 12px; font-weight: 600; text-align: center; white-space: nowrap; }
    .project-calendar__create { display: inline-flex; height: 44px; align-items: center; gap: 7px; border: 0; border-radius: 9px; padding: 0 14px; background: var(--color-accent); color: var(--color-accent-contrast, #fff); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 5px 12px color-mix(in srgb, var(--color-accent) 22%, transparent); transition: filter 160ms ease, transform 160ms ease; }
    .project-calendar__create:hover:not(:disabled) { filter: brightness(.96); transform: translateY(-1px); }
    .project-calendar__create:disabled { cursor: not-allowed; opacity: .5; }
    .project-calendar__create:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .project-calendar__create svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__error { border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent); border-radius: 9px; padding: 11px 13px; background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface)); color: var(--color-danger); font-size: 13px; }
    .project-calendar__empty { border: 1px dashed var(--color-border); border-radius: 11px; padding: 42px 20px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .project-calendar__layout { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) 220px; align-items: start; gap: 14px; }
    .project-calendar__timeline-scroll { min-width: 0; overflow-x: auto; border: 1px solid var(--color-border); border-radius: 11px; background: var(--color-surface); }
    .project-calendar__timeline { min-height: 100%; }
    .project-calendar__grid { display: grid; }
    .project-calendar__grid--header { min-height: 54px; border-bottom: 1px solid var(--color-border); }
    .project-calendar__grid--row { min-height: 76px; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent); }
    .project-calendar__grid--row:last-child { border-bottom: 0; }
    .project-calendar__label-header { display: flex; align-items: center; padding: 0 14px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
    .project-calendar__date-header { position: relative; overflow: hidden; border-left: 1px solid var(--color-border); background: var(--color-surface-secondary); }
    .project-calendar__date-marker { position: absolute; top: 0; bottom: 0; display: flex; width: 64px; align-items: center; padding-left: 8px; border-left: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent); color: var(--color-text-secondary); font-size: 10px; font-weight: 600; white-space: nowrap; }
    .project-calendar__objective { min-width: 0; overflow: hidden; padding: 12px 10px 10px 0; }
    .project-calendar__objective-title { display: flex; min-width: 0; align-items: center; gap: 7px; overflow: hidden; font-size: 13px; font-weight: 600; line-height: 1.35; }
    .project-calendar__objective-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .project-calendar__folder-icon { width: 16px; height: 16px; flex: 0 0 auto; fill: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); stroke: var(--color-accent); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__objective-dates { margin: 5px 0 0 23px; color: var(--color-text-secondary); font-size: 11px; white-space: nowrap; }
    .project-calendar__track { position: relative; min-width: 0; overflow: hidden; border-left: 1px solid var(--color-border); }
    .project-calendar__grid-background { position: absolute; inset: 0; opacity: .5; }
    @media (max-width: 900px) { .project-calendar__layout { grid-template-columns: minmax(0, 1fr); } .project-calendar__actions { width: 100%; justify-content: flex-start; } }
    @media (max-width: 560px) { .project-calendar__actions app-work-dropdown { flex: 1 1 150px; width: auto; } .project-calendar__create { flex: 1 1 150px; justify-content: center; } }
  `]
})
export class ProjectCalendarComponent implements OnInit {
  readonly store = inject(ProjectCalendarStore);
  private readonly route = inject(ActivatedRoute);
  readonly LABEL_WIDTH = 240;
  readonly modalOpen = signal(false);
  readonly editingEvent = signal<CalendarEventDto | null>(null);
  readonly projectId = signal<string | null>(null);
  readonly calendarView = signal<CalendarView>('default');
  // null = not navigated yet, falls back to timelineStart() as the starting period.
  // Only meaningful for week/month/year - 'default' always shows the full range.
  private readonly viewAnchor = signal<string | null>(null);
  readonly viewOptions: readonly WorkDropdownOption[] = [
    { value: 'default', label: 'Default timeline' },
    { value: 'week', label: 'Week view' },
    { value: 'month', label: 'Month view' },
    { value: 'year', label: 'Year view' }
  ];

  readonly timelineStart = computed(() => {
    const dates = this.store.items().map((item) => item.startDate).filter(Boolean).sort();
    return dates[0] ?? new Date().toISOString().slice(0, 10);
  });
  readonly timelineEnd = computed(() => {
    const dates = this.store.items().map((item) => item.endDate).filter(Boolean).sort();
    return dates.at(-1) ?? addCalendarDays(this.timelineStart(), 30);
  });
  readonly effectiveAnchor = computed(() => this.viewAnchor() ?? this.timelineStart());
  readonly viewRange = computed(() => periodRangeFor(this.calendarView(), this.effectiveAnchor(), this.timelineStart(), this.timelineEnd()));
  readonly visibleTimelineStart = computed(() => this.viewRange().start);
  readonly visibleTimelineEnd = computed(() => this.viewRange().end);
  readonly days = computed(() => calendarRange(this.visibleTimelineStart(), this.visibleTimelineEnd()));
  readonly dayWidth = computed(() => {
    switch (this.calendarView()) {
      case 'week': return 82;
      case 'month': return 38;
      case 'year': return 20;
      default: return 32;
    }
  });
  readonly markerStep = computed(() => {
    switch (this.calendarView()) {
      case 'week': return 1;
      case 'month': return 2;
      case 'year': return 14;
      default: return 7;
    }
  });
  readonly dateMarkers = computed(() => this.days().filter((_, index) => index % this.markerStep() === 0));
  readonly timelineWidth = computed(() => Math.max(1, this.days().length) * this.dayWidth());
  readonly rows = computed(() => buildCalendarTreeOrder(this.store.items()));
  readonly viewRangeLabel = computed(() => {
    const { start } = this.viewRange();
    switch (this.calendarView()) {
      case 'week':
        return `${this.formatDayLabel(start)} – ${this.formatDayLabel(this.viewRange().end)}, ${parseCalendarDate(start).getUTCFullYear()}`;
      case 'month':
        return parseCalendarDate(start).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      case 'year':
        return String(parseCalendarDate(start).getUTCFullYear());
      default:
        return '';
    }
  });

  ngOnInit(): void {
    const id = this.route.snapshot.parent?.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
    if (id) {
      this.projectId.set(id);
      void this.store.load(id);
    }
  }

  setCalendarView(value: string): void {
    this.calendarView.set(value as CalendarView);
    this.viewAnchor.set(null); // start each newly selected view at the project's own start
  }

  previousPeriod(): void {
    this.viewAnchor.set(this.shiftAnchor(-1));
  }

  nextPeriod(): void {
    this.viewAnchor.set(this.shiftAnchor(1));
  }

  private shiftAnchor(direction: 1 | -1): string {
    const anchor = this.effectiveAnchor();
    switch (this.calendarView()) {
      case 'week':
        return addCalendarDays(anchor, direction * 7);
      case 'month':
        return addCalendarMonths(startOfMonth(anchor), direction);
      case 'year': {
        const year = parseCalendarDate(anchor).getUTCFullYear() + direction;
        return `${year}-01-01`;
      }
      default:
        return anchor;
    }
  }

  dayIndex(day: string): number {
    return calendarDayDifference(this.visibleTimelineStart(), day);
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

  openEditEvent(event: CalendarEventDto): void {
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
