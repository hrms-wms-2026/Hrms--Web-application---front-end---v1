import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CalendarEventLegendComponent } from '../../ui/calendar-event-legend/calendar-event-legend.component';
import { CalendarEventModalComponent } from '../../ui/calendar-event-modal/calendar-event-modal.component';
import { ObjectiveTimelineBarComponent } from '../../ui/objective-timeline-bar/objective-timeline-bar.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import {
  CalendarDateChange,
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';
import { ProjectCalendarStore } from '../../state/project-calendar.store';
import { addCalendarDays, calendarDayDifference, calendarRange, parseCalendarDate } from '../../utils/calendar-date.utils';
import { buildCalendarTreeOrder } from '../../utils/calendar-tree.utils';

// Auto-assigned per-branch bar colors, same spirit as the calendar's own per-event
// colors (calendar-event-modal) - distinct, muted hues that read well with white bar
// text, cycling if there are more top-level modules than swatches.
const BRANCH_PALETTE = ['#2563EB', '#0D9488', '#C026D3', '#EA580C', '#4F46E5', '#059669', '#DB2777', '#0891B2'];

interface MilestoneMarker { objectiveId: string; eventId: string; name: string; startDate: string; endDate: string; left: number; color: string; }

@Component({
  selector: 'app-project-calendar',
  standalone: true,
  imports: [ObjectiveTimelineBarComponent, CalendarEventModalComponent, CalendarEventLegendComponent, ButtonComponent],
  template: `
    <ng-template #toolbarTpl>
      <div class="project-calendar__toolbar">
        <div class="project-calendar__zoom" data-testid="zoom-controls">
          <button type="button" class="project-calendar__zoom-step" aria-label="Zoom out" [disabled]="isAtMinZoom()" (click)="zoomOut()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8 11h6" /></svg>
          </button>
          <button type="button" class="project-calendar__zoom-fit" data-testid="fit-to-screen" (click)="fitToScreen()">Fit</button>
          <button type="button" class="project-calendar__zoom-step" aria-label="Zoom in" [disabled]="isAtMaxZoom()" (click)="zoomIn()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>
          </button>
        </div>
        <app-button
          variant="primary"
          [disabled]="store.loading() || !store.modules().length"
          (pressed)="openCreateEvent()"
        >
          Create milestone
        </app-button>
      </div>
    </ng-template>

    <section class="project-calendar" data-testid="project-calendar">

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
              @for (row of rows(); track row.item.objectiveId) {
                <div class="project-calendar__grid project-calendar__grid--row" [style.gridTemplateColumns]="LABEL_WIDTH + 'px ' + timelineWidth() + 'px'" [attr.data-testid]="'calendar-row-' + row.item.objectiveId">
                  <div class="project-calendar__objective">
                    @if (row.depth > 0) {
                      <div class="project-calendar__guides" [style.width.px]="row.depth * 18">
                        @for (continues of row.ancestorLines; track $index) {
                          <span class="project-calendar__guide-col" [class.project-calendar__guide-col--through]="continues"></span>
                        }
                        <span class="project-calendar__guide-col project-calendar__guide-col--elbow" [class.project-calendar__guide-col--elbow-through]="!row.isLast"></span>
                      </div>
                    }
                    <div class="project-calendar__objective-body" [style.marginLeft.px]="row.depth * 18">
                      <div class="project-calendar__objective-title" [title]="row.item.title">
                        @if (row.hasChildren && row.depth > 0) {
                          <button
                            type="button"
                            class="project-calendar__chevron"
                            [style.transform]="isCollapsed(row.item.objectiveId) ? 'rotate(0deg)' : 'rotate(90deg)'"
                            [attr.aria-label]="isCollapsed(row.item.objectiveId) ? 'Expand' : 'Collapse'"
                            data-testid="calendar-chevron"
                            (click)="toggleCollapsed(row.item.objectiveId, $event)"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                          </button>
                        } @else {
                          <span class="project-calendar__chevron-spacer"></span>
                        }
                        @if (row.depth === 0) {
                          <svg class="project-calendar__folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" /><path d="M2.5 9h18" /></svg>
                        } @else {
                          <span class="project-calendar__branch-dot" [style.background]="branchColors().get(row.branchRootId)" aria-hidden="true"></span>
                        }
                        <span>{{ row.item.title }}</span>
                      </div>
                      <div class="project-calendar__objective-dates">{{ formatDateRange(row.item.startDate, row.item.endDate) }}</div>
                    </div>
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
                      [isRoot]="row.depth === 0"
                      (dateChange)="saveDates($event)"
                    />
                    @for (marker of markersForRow(row.item.objectiveId); track marker.eventId) {
                      <span
                        class="project-calendar__milestone-marker"
                        data-testid="calendar-milestone-marker"
                        [style.left.px]="marker.left"
                        [style.background]="marker.color"
                        [title]="marker.name + '  ' + marker.startDate + ' → ' + marker.endDate"
                      ></span>
                    }
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
        [projectId]="projectId() ?? ''"
        (cancel)="modalOpen.set(false)"
        (save)="saveEvent($event)"
      />
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .project-calendar__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .project-calendar__toolbar ::ng-deep app-button > button { width: auto; height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px; }
    .project-calendar__zoom { display: flex; align-items: center; gap: 2px; height: 30px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 3px; background: var(--color-surface); box-sizing: border-box; }
    .project-calendar__zoom-step { display: flex; height: 22px; width: 22px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
    .project-calendar__zoom-step:hover:not(:disabled) { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .project-calendar__zoom-step:disabled { cursor: not-allowed; opacity: .35; }
    .project-calendar__zoom-step:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .project-calendar__zoom-step svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__zoom-fit { height: 22px; flex: 0 0 auto; border: 0; border-left: 1px solid var(--color-border); border-right: 1px solid var(--color-border); margin: 0 2px; padding: 0 8px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
    .project-calendar__zoom-fit:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .project-calendar__zoom-fit:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .project-calendar__error { border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent); border-radius: 9px; padding: 11px 13px; background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface)); color: var(--color-danger); font-size: 13px; }
    .project-calendar__empty { border: 1px dashed var(--color-border); border-radius: 11px; padding: 42px 20px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .project-calendar__layout { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) 220px; align-items: start; gap: 14px; }
    .project-calendar__timeline-scroll { min-width: 0; overflow-x: auto; border: 1px solid var(--color-border); border-radius: 11px; background: var(--color-surface); }
    .project-calendar__timeline { position: relative; min-height: 100%; }
    .project-calendar__milestone-marker { position: absolute; top: 50%; z-index: 4; width: 9px; height: 9px; transform: translate(-50%, -50%) rotate(45deg); border-radius: 2px; box-shadow: 0 0 0 1.5px var(--color-surface); }
    .project-calendar__today-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--color-danger); z-index: 5; pointer-events: none; }
    .project-calendar__today-label { position: absolute; top: -17px; left: 50%; transform: translateX(-50%); border-radius: 4px; background: var(--color-danger); padding: 1px 5px; color: #fff; font-size: 9px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; white-space: nowrap; }
    .project-calendar__grid { display: grid; }
    .project-calendar__grid--header { min-height: 54px; border-bottom: 1px solid var(--color-border); }
    .project-calendar__grid--row { min-height: 58px; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent); animation: project-calendar-row-in 220ms ease; transition: background-color 140ms ease; }
    .project-calendar__grid--row:hover { background: var(--color-surface-secondary); }
    .project-calendar__grid--row:last-child { border-bottom: 0; }
    @keyframes project-calendar-row-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .project-calendar__grid--row { animation: none; } }
    .project-calendar__label-header { display: flex; align-items: center; padding: 0 14px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
    .project-calendar__date-header { position: relative; overflow: hidden; border-left: 1px solid var(--color-border); background: var(--color-surface-secondary); }
    .project-calendar__date-marker { position: absolute; top: 0; bottom: 0; display: flex; overflow: hidden; align-items: center; padding-left: 8px; border-left: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent); color: var(--color-text-secondary); font-size: 10px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
    .project-calendar__objective { position: relative; min-width: 0; overflow: hidden; padding: 9px 10px 8px 12px; }
    .project-calendar__guides { position: absolute; left: 12px; top: 0; bottom: 0; display: flex; pointer-events: none; }
    .project-calendar__guide-col { position: relative; flex: 0 0 18px; width: 18px; }
    .project-calendar__guide-col--through::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: color-mix(in srgb, var(--color-text-secondary) 45%, transparent); border-radius: 1px; }
    .project-calendar__guide-col--elbow::before { content: ''; position: absolute; left: 8px; top: 0; height: 50%; width: 2px; background: color-mix(in srgb, var(--color-text-secondary) 45%, transparent); border-radius: 1px; }
    .project-calendar__guide-col--elbow.project-calendar__guide-col--elbow-through::before { height: 100%; }
    .project-calendar__guide-col--elbow::after { content: ''; position: absolute; left: 8px; top: 50%; width: 11px; height: 2px; background: color-mix(in srgb, var(--color-text-secondary) 45%, transparent); border-radius: 1px; }
    .project-calendar__objective-body { min-width: 0; }
    .project-calendar__objective-title { display: flex; min-width: 0; align-items: center; gap: 6px; overflow: hidden; font-size: 13px; font-weight: 600; line-height: 1.35; }
    .project-calendar__objective-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .project-calendar__chevron, .project-calendar__chevron-spacer { flex: 0 0 auto; width: 16px; height: 16px; }
    .project-calendar__chevron { display: flex; align-items: center; justify-content: center; border: 0; padding: 0; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: transform 140ms ease, color 140ms ease; }
    .project-calendar__chevron:hover { color: var(--color-text-primary); }
    .project-calendar__chevron:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .project-calendar__chevron svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__folder-icon { width: 16px; height: 16px; flex: 0 0 auto; fill: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); stroke: var(--color-accent); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .project-calendar__branch-dot { width: 9px; height: 9px; flex: 0 0 auto; border-radius: 999px; }
    .project-calendar__objective-dates { margin: 4px 0 0 22px; color: var(--color-text-secondary); font-size: 11px; white-space: nowrap; }
    .project-calendar__track { position: relative; min-width: 0; overflow: hidden; border-left: 1px solid var(--color-border); }
    .project-calendar__grid-background { position: absolute; inset: 0; opacity: .5; }
    @media (max-width: 900px) { .project-calendar__layout { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class ProjectCalendarComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(ProjectCalendarStore);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild<TemplateRef<unknown>>('toolbarTpl');
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
  // Objective ids collapsed via the tree chevron - their descendants are left out of
  // rows() entirely, same as the Tree tab, so a collapsed branch's bars disappear too.
  readonly collapsedIds = signal<ReadonlySet<string>>(new Set());

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
  readonly rows = computed(() => buildCalendarTreeOrder(this.store.modules(), this.collapsedIds()));
  // Assigns each top-level module (and everything nested under it) a stable color from
  // BRANCH_PALETTE, in the order branches first appear - so bars read as one colored
  // family per branch instead of one flat gray, matching the connector-line grouping.
  // The project-root row is excluded - it gets its own fixed summary color instead.
  readonly branchColors = computed(() => {
    const map = new Map<string, string>();
    let next = 0;
    for (const row of this.rows()) {
      if (row.depth === 0 || map.has(row.branchRootId)) continue;
      map.set(row.branchRootId, BRANCH_PALETTE[next % BRANCH_PALETTE.length]);
      next++;
    }
    return map;
  });
  readonly milestoneMarkers = computed<MilestoneMarker[]>(() => {
    const markers: MilestoneMarker[] = [];
    for (const row of this.rows()) {
      for (const link of row.item.events ?? []) {
        markers.push({
          objectiveId: row.item.objectiveId,
          eventId: link.eventId,
          name: link.eventName,
          startDate: link.eventStartDate,
          endDate: link.eventEndDate,
          left: this.dayIndex(link.eventEndDate) * this.dayWidth(),
          color: link.eventColor
        });
      }
    }
    return markers;
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
    const tpl = this.toolbarTpl();
    if (tpl) {
      this.toolbarStore.setTemplate(tpl);
    }
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
    this.toolbarStore.setTemplate(null);
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

  markersForRow(objectiveId: string): MilestoneMarker[] {
    return this.milestoneMarkers().filter((m) => m.objectiveId === objectiveId);
  }

  isCollapsed(objectiveId: string): boolean {
    return this.collapsedIds().has(objectiveId);
  }

  toggleCollapsed(objectiveId: string, event: Event): void {
    event.stopPropagation();
    this.collapsedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(objectiveId)) next.delete(objectiveId);
      else next.add(objectiveId);
      return next;
    });
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
