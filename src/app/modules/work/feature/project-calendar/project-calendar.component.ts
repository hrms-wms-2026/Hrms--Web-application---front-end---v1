import { NgTemplateOutlet } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CalendarEventModalComponent } from '../../ui/calendar-event-modal/calendar-event-modal.component';
import { ObjectiveTimelineBarComponent } from '../../ui/objective-timeline-bar/objective-timeline-bar.component';
import { ModuleTreeRowComponent } from '../../ui/module-tree-row/module-tree-row.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import {
  CalendarDateChange,
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  ProjectCalendarModuleDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { MilestoneExplanationPanelComponent } from '../../ui/milestone-explanation-panel/milestone-explanation-panel.component';
import { ProjectCalendarStore } from '../../state/project-calendar.store';
import { ProjectMonitorStore } from '../../state/project-monitor.store';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { deriveMilestoneStatus, MilestoneStatus } from '../../utils/milestone-status.utils';
import { addCalendarDays, calendarDayDifference, calendarRange, parseCalendarDate } from '../../utils/calendar-date.utils';
import { buildCalendarTreeOrder } from '../../utils/calendar-tree.utils';

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  upcoming: 'Upcoming', on_track: 'On Track', at_risk: 'At Risk', completed: 'Completed'
};

interface MilestoneMarker { objectiveId: string; eventId: string; name: string; startDate: string; endDate: string; left: number; color: string; }

@Component({
  selector: 'app-project-calendar',
  standalone: true,
  imports: [NgTemplateOutlet, ObjectiveTimelineBarComponent, ModuleTreeRowComponent, CalendarEventModalComponent, MilestoneExplanationPanelComponent, DataTableComponent, DataTableCellDirective, ButtonComponent, SelectComponent],
  template: `
    <ng-template #toolbarTpl>
      <div class="project-calendar__toolbar">
        <app-button
          variant="primary"
          [disabled]="store.loading() || !store.modules().length"
          (pressed)="openCreateEvent()"
        >
          + Add Milestone
        </app-button>
      </div>
    </ng-template>

    <ng-template #panelTpl>
      @if (panelEventId(); as eventId) {
        @if (store.eventDetail(); as detail) {
          @if (detail.id === eventId) {
            <app-milestone-explanation-panel
              [event]="detail"
              [modules]="store.modules()"
              [tasks]="store.eventTasks()"
              [activity]="store.eventActivity()"
              [hasOpenAlert]="hasOpenAlertForEvent(eventId)"
              (tabActivated)="onPanelTabActivated(eventId, $event)"
              (editRequested)="openEditEvent($event)"
              (closeRequested)="closeEvent($event)"
              (dismissed)="closeMilestonePanel()"
            />
          }
        }
      }
    </ng-template>

    <section class="project-calendar" data-testid="project-calendar">
      <header class="project-calendar__page-header">
        <div class="project-calendar__controls">
          <div class="project-calendar__view-toggle" role="tablist" aria-label="View mode">
            <button type="button" role="tab" data-testid="view-toggle-list" [attr.aria-selected]="viewMode() === 'list'" (click)="viewMode.set('list')">List</button>
            <button type="button" role="tab" data-testid="view-toggle-timeline" [attr.aria-selected]="viewMode() === 'timeline'" (click)="viewMode.set('timeline')">Timeline</button>
          </div>
          <app-select class="project-calendar__granularity" ariaLabel="Zoom granularity" data-testid="granularity-select" [options]="granularityOptions" [value]="granularity()" (valueChange)="setGranularity($any($event))" />
          <div class="project-calendar__month-nav" data-testid="calendar-month-nav">
            <button type="button" class="project-calendar__month-step" aria-label="Previous month" (click)="scrollMonth(-1)">‹</button>
            <span data-testid="calendar-range-label">{{ rangeLabel() }}</span>
            <button type="button" class="project-calendar__month-step" aria-label="Next month" (click)="scrollMonth(1)">›</button>
          </div>
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
        <div class="project-calendar__layout" data-testid="project-calendar-timeline" [hidden]="viewMode() !== 'timeline'" [class.project-calendar__layout--panel-open]="panelEventId()">
          <div class="project-calendar__main">
          <div class="project-calendar__timeline-scroll" #scrollContainer>
            <div class="project-calendar__timeline" [style.minWidth.px]="trackWidth() + LABEL_WIDTH">
              <div class="project-calendar__grid project-calendar__grid--header" [style.gridTemplateColumns]="LABEL_WIDTH + 'px ' + trackWidth() + 'px'">
                <div class="project-calendar__label-header"><span>Project Structure</span><span class="project-calendar__progress-header">Progress</span></div>
                <div class="project-calendar__date-header" [style.width.px]="trackWidth()">
                  @for (day of dateMarkers(); track day) {
                    <div class="project-calendar__date-marker" [style.left.px]="dayIndex(day) * dayWidth()" [style.width.px]="markerBoxWidth()">{{ formatDayLabel(day) }}</div>
                  }
                </div>
              </div>
              @for (row of rows(); track row.item.objectiveId) {
                <div class="project-calendar__grid project-calendar__grid--row" [style.gridTemplateColumns]="LABEL_WIDTH + 'px ' + trackWidth() + 'px'" [attr.data-testid]="'calendar-row-' + row.item.objectiveId">
                  <div class="project-calendar__objective">
                    <div class="project-calendar__objective-body" [style.marginLeft.px]="row.depth * 18">
                      <app-module-tree-row
                        [compact]="true"
                        [node]="toTreeNode(row.item)"
                        [depth]="row.depth"
                        [showChevron]="row.hasChildren && row.depth > 0"
                        [expanded]="!isCollapsed(row.item.objectiveId)"
                        (chevronClicked)="toggleCollapsed(row.item.objectiveId, $event)"
                      />
                    </div>
                    <span class="project-calendar__progress-cell" data-testid="calendar-progress-cell">{{ progressLabelFor(row.item) }}</span>
                  </div>
                  <div class="project-calendar__track" [style.width.px]="trackWidth()">
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
                        data-testid="calendar-milestone-marker" (click)="openMilestonePanel(marker.eventId)"
                        [style.left.px]="marker.left"
                        [style.background]="marker.color"
                        [title]="marker.name + '  ' + marker.startDate + ' → ' + marker.endDate"
                      ></span>
                      <span class="project-calendar__milestone-label" data-testid="calendar-milestone-label" (click)="openMilestonePanel(marker.eventId)" [style.left.px]="marker.left + 14">
                        <strong>{{ marker.name }}</strong>
                        <span>{{ formatLongDate(marker.endDate) }}</span>
                      </span>
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
          <footer class="project-calendar__footer">
            <ul class="project-calendar__legend" aria-label="Status legend">
              @for (item of statusLegend; track item.label) {
                <li><span class="project-calendar__legend-diamond" [style.background]="item.color"></span>{{ item.label }}</li>
              }
            </ul>
            <div class="project-calendar__zoom" data-testid="zoom-controls">
              <button type="button" class="project-calendar__zoom-fit" data-testid="fit-to-screen" (click)="fitToScreen()">Fit to view</button>
              <button type="button" class="project-calendar__zoom-step" aria-label="Zoom out" [disabled]="isAtMinZoom()" (click)="zoomOut()">−</button>
              <input type="range" class="project-calendar__zoom-slider" aria-label="Zoom" data-testid="zoom-slider"
                [min]="fitDayWidth()" [max]="MAX_DAY_WIDTH" step="0.5" [value]="dayWidth()" (input)="zoomDayWidth.set(+$any($event.target).value)" />
              <button type="button" class="project-calendar__zoom-step" aria-label="Zoom in" [disabled]="isAtMaxZoom()" (click)="zoomIn()">+</button>
              <button type="button" class="project-calendar__zoom-step" aria-label="Toggle full screen" data-testid="fullscreen-toggle" (click)="toggleFullscreen()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
              </button>
            </div>
          </footer>
          </div>
          @if (panelEventId()) {
            <div class="project-calendar__side">
              <ng-container *ngTemplateOutlet="panelTpl" />
            </div>
          }
        </div>
        @if (viewMode() === 'list') {
          <div class="project-calendar__list-layout" data-testid="project-calendar-list" [class.project-calendar__list-layout--panel-open]="panelEventId()">
            <app-data-table
              [columns]="milestoneListColumns"
              [rows]="milestoneListRows()"
              [trackBy]="trackMilestoneRow"
              emptyMessage="No active milestones yet."
              [rowClickable]="true"
              (rowClicked)="openMilestonePanel($event.eventId)"
            >
              <ng-template appDataTableCell="name" let-row>
                <span data-testid="milestone-list-row" class="flex items-center gap-2">
                  <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="row.color"></span>{{ row.name }}
                </span>
              </ng-template>
              <ng-template appDataTableCell="status" let-row>{{ row.status }}</ng-template>
              <ng-template appDataTableCell="endDate" let-row>{{ row.endDate }}</ng-template>
              <ng-template appDataTableCell="moduleCount" let-row>{{ row.moduleCount }}</ng-template>
            </app-data-table>
            <ng-container *ngTemplateOutlet="panelTpl" />
          </div>
        }
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
    .project-calendar__month-nav { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 4px; font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .project-calendar__month-step { display: flex; height: 22px; width: 22px; align-items: center; justify-content: center; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .project-calendar__month-step:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
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
    .project-calendar__layout { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 14px; }
    .project-calendar__layout--panel-open { grid-template-columns: minmax(0, 1fr) 360px; }
    .project-calendar__layout[hidden] { display: none; }
    .project-calendar__list-layout { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 14px; }
    .project-calendar__list-layout--panel-open { grid-template-columns: minmax(0, 1fr) 360px; }
    .project-calendar__view-toggle { display: flex; height: 30px; align-items: center; gap: 2px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 3px; background: var(--color-surface); box-sizing: border-box; }
    .project-calendar__view-toggle button { height: 22px; border: 0; border-radius: 6px; padding: 0 9px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
    .project-calendar__view-toggle button[aria-selected='true'] { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .project-calendar__side { display: flex; min-width: 0; flex-direction: column; gap: 14px; }
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
    .project-calendar__date-header { position: relative; overflow: hidden; background: var(--color-surface-secondary); }
    .project-calendar__date-marker { position: absolute; top: 0; bottom: 0; display: flex; overflow: hidden; align-items: center; padding-left: 8px; border-left: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent); color: var(--color-text-secondary); font-size: 10px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
    .project-calendar__objective { position: relative; display: flex; align-items: center; min-width: 0; overflow: hidden; padding: 9px 10px 8px 12px; }
    .project-calendar__objective-body { min-width: 0; flex: 1; }
    .project-calendar__track { position: relative; min-width: 0; overflow: hidden; }
    .project-calendar__grid-background { position: absolute; inset: 0; opacity: .5; }
    @media (max-width: 900px) { .project-calendar__layout { grid-template-columns: minmax(0, 1fr); } }
    .project-calendar__page-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; margin-bottom: 14px; }
    .project-calendar__controls { display: flex; align-items: center; gap: 10px; }
    .project-calendar__granularity { width: 8.5rem; }
    .project-calendar__main { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
    .project-calendar__view-toggle { height: 32px; padding: 2px; border-radius: 8px; }
    .project-calendar__view-toggle button { height: 26px; padding: 0 14px; font-size: 12px; }
    .project-calendar__view-toggle button[aria-selected='true'] { background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); }
    .project-calendar__label-header { justify-content: space-between; padding: 0 14px; text-transform: none; letter-spacing: 0; font-size: 12px; color: var(--color-text-secondary); }
    .project-calendar__progress-header { width: 56px; text-align: right; }
    .project-calendar__progress-cell { flex: 0 0 56px; text-align: right; color: var(--color-text-primary); font-size: 12px; font-weight: 600; }
    .project-calendar__date-marker { color: var(--color-text-primary); font-size: 12px; font-weight: 500; justify-content: center; padding-left: 0; }
    .project-calendar__track { overflow: visible; }
    .project-calendar__milestone-marker { width: 14px; height: 14px; border-radius: 3px; cursor: pointer; z-index: 6; }
    .project-calendar__milestone-label { position: absolute; top: 50%; z-index: 5; display: flex; flex-direction: column; transform: translateY(-50%); cursor: pointer; white-space: nowrap; pointer-events: auto; }
    .project-calendar__milestone-label strong { color: var(--color-text-primary); font-size: 12px; font-weight: 600; line-height: 1.2; }
    .project-calendar__milestone-label span { color: var(--color-text-secondary); font-size: 11px; }
    .project-calendar__today-line { border-left: 2px dashed var(--color-danger); background: transparent; width: 0; top: 54px; }
    .project-calendar__today-label { top: auto; bottom: -22px; padding: 4px 10px; border-radius: 6px; font-size: 12px; text-transform: none; }
    .project-calendar__footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-top: 10px; }
    .project-calendar__legend { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; margin: 0; padding: 0; list-style: none; color: var(--color-text-primary); font-size: 12px; }
    .project-calendar__legend li { display: flex; align-items: center; gap: 7px; }
    .project-calendar__legend-diamond { width: 11px; height: 11px; border-radius: 2px; transform: rotate(45deg); }
    .project-calendar__footer .project-calendar__zoom { gap: 8px; height: 34px; padding: 0 6px; border: 0; background: transparent; }
    .project-calendar__footer .project-calendar__zoom-fit { height: 32px; border: 1px solid var(--color-border); border-radius: 8px; margin: 0; padding: 0 14px; text-transform: none; letter-spacing: 0; font-size: 12px; font-weight: 500; background: var(--color-surface); color: var(--color-text-primary); }
    .project-calendar__footer .project-calendar__zoom-step { width: 32px; height: 32px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); font-size: 16px; }
    .project-calendar__zoom-slider { width: 110px; accent-color: var(--color-accent); }
  `]
})
export class ProjectCalendarComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(ProjectCalendarStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly monitor = inject(ProjectMonitorStore);
  readonly panelEventId = signal<string | null>(null);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild<TemplateRef<unknown>>('toolbarTpl');
  private readonly route = inject(ActivatedRoute);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private resizeObserver?: ResizeObserver;
  readonly LABEL_WIDTH = 320;
  private readonly TRAIL_WIDTH = 200;
  private readonly MIN_FIT_DAY_WIDTH = 3;
  readonly MAX_DAY_WIDTH = 160;
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
    const available = this.containerWidth() - this.LABEL_WIDTH - this.TRAIL_WIDTH;
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
  readonly viewMode = signal<'timeline' | 'list'>('timeline');
  readonly milestoneListColumns: DataTableColumn[] = [
    { key: 'name', label: 'Milestone', width: '40%' },
    { key: 'status', label: 'Status' },
    { key: 'endDate', label: 'Target Date' },
    { key: 'moduleCount', label: 'Modules' }
  ];
  readonly trackMilestoneRow = (row: { eventId: string }): string => row.eventId;
  // Counted from ALL modules (not rows()), so collapsing the Gantt tree never changes a milestone's count;
  // at-risk is derived per event from the modules it is actually linked to.
  readonly milestoneListRows = computed(() => {
    const objectiveIdsByEvent = new Map<string, string[]>();
    for (const module of this.store.modules()) {
      for (const link of module.events ?? []) {
        const list = objectiveIdsByEvent.get(link.eventId);
        if (list) list.push(module.objectiveId); else objectiveIdsByEvent.set(link.eventId, [module.objectiveId]);
      }
    }
    return this.store.activeEvents().map((band) => {
      const linkedObjectiveIds = objectiveIdsByEvent.get(band.eventId) ?? [];
      const hasOpenAlert = linkedObjectiveIds.some((id) => this.monitor.alertsFor(id).some((a) => !a.inAchievedModule));
      return {
        eventId: band.eventId,
        name: band.name,
        color: band.color,
        status: MILESTONE_STATUS_LABEL[deriveMilestoneStatus({ status: 'active', startDate: band.startDate, endDate: band.endDate }, this.today, hasOpenAlert)],
        endDate: band.endDate,
        moduleCount: linkedObjectiveIds.length
      };
    });
  });
  readonly trackWidth = computed(() => this.timelineWidth() + this.TRAIL_WIDTH);
  /** "May 2026 – Dec 2026": the project's full date span, shown beside the month prev/next arrows. */
  readonly rangeLabel = computed(() => {
    const month = (day: string) => parseCalendarDate(day).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `${month(this.timelineStart())} – ${month(this.timelineEnd())}`;
  });
  readonly granularity = signal<'week' | 'month' | 'quarter'>('month');
  readonly granularityOptions: readonly SelectOption[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' }
  ];
  readonly statusLegend = [
    { label: 'On Track', color: '#16A34A' }, { label: 'At Risk', color: '#EF4444' },
    { label: 'Upcoming', color: '#F59E0B' }, { label: 'Completed', color: '#2563EB' },
    { label: 'Not Started', color: '#CBD5E1' }
  ];
  readonly todayVisible = computed(() => this.today >= this.timelineStart() && this.today <= this.timelineEnd());
  readonly todayOffset = computed(() => this.dayIndex(this.today) * this.dayWidth());

  ngOnInit(): void {
    const id = this.route.snapshot.parent?.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
    if (id) {
      this.projectId.set(id);
      void this.store.load(id);
      void this.monitor.load(id);
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

  setGranularity(value: 'week' | 'month' | 'quarter'): void {
    this.granularity.set(value);
    this.zoomDayWidth.set({ week: 48, month: 14, quarter: 5 }[value]);
  }

  formatLongDate(day: string): string {
    return parseCalendarDate(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void this.host.nativeElement.requestFullscreen?.();
  }

  scrollMonth(direction: 1 | -1): void {
    this.scrollContainer()?.nativeElement.scrollBy({ left: direction * 30 * this.dayWidth(), behavior: 'smooth' });
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

  toTreeNode(item: ProjectCalendarModuleDto): MilestoneTreeNode {
    return {
      id: item.objectiveId,
      title: item.title,
      description: item.description ?? null,
      startDate: item.startDate,
      endDate: item.endDate,
      progress: item.progressPercent ?? 0,
      allocatedHours: item.allocatedHours ?? 0,
      completedHours: 0,
      isActive: item.isActive,
      isAchieved: item.isAchieved,
      ownerName: null,
      isOwner: false,
      children: [],
      kind: 'objective'
    };
  }

  /** Review Focus: a subtree with zero tasks must read as "-", never "0%" - progressPercent is
   *  null in exactly that case (Task A3), so this is the only place that distinction survives;
   *  toTreeNode()'s `progress` field above is a plain number and can't carry it. */
  progressLabelFor(item: ProjectCalendarModuleDto): string | null {
    return item.progressPercent == null ? '—' : `${item.progressPercent}%`;
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

  openMilestonePanel(eventId: string): void {
    this.panelEventId.set(eventId);
    void this.store.loadEventDetail(eventId);
    void this.store.loadEventTasks(eventId); // feeds the Tasks (n) tab count, progress and Key Metrics on Overview
  }

  closeMilestonePanel(): void {
    this.panelEventId.set(null);
    this.store.clearEventPanel();
  }

  onPanelTabActivated(eventId: string, tab: 'overview' | 'modules' | 'tasks' | 'activity'): void {
    if (tab === 'tasks') void this.store.loadEventTasks(eventId);
    if (tab === 'activity') void this.store.loadEventActivity(eventId);
  }

  /** Design §5's "at risk" input: an open alert on a linked module, excluding alerts the Tree tab
   *  treats as informational-only (achieved modules - faded, never counted). */
  hasOpenAlertForEvent(eventId: string): boolean {
    const detail = this.store.eventDetail();
    if (!detail || detail.id !== eventId) return false;
    return detail.objectiveIds.some((id) => this.monitor.alertsFor(id).some((a) => !a.inAchievedModule));
  }

  async openEditEvent(eventId: string): Promise<void> {
    // Real taskIds (Design §7): the legend stub always has taskIds [], so saving it silently deleted
    // every hand-picked task link. Act on the RETURN value - after a failed refresh of an open panel,
    // store state still holds the old matching detail and would look like success.
    const detail = await this.store.loadEventDetail(eventId);
    if (!detail) return; // never open a blank modal: it would save as a new event and drop existing links
    this.editingEvent.set(detail);
    this.modalOpen.set(true);
  }

  async saveEvent(payload: CreateCalendarEventRequestDto | UpdateCalendarEventRequestDto): Promise<void> {
    const editing = this.editingEvent();
    const success = editing
      ? await this.store.updateEvent(editing.id, payload)
      : await this.store.createEvent(payload as CreateCalendarEventRequestDto);
    if (success) this.modalOpen.set(false);
  }

  async closeEvent(id: string): Promise<void> {
    await this.store.closeEvent(id);
    if (this.panelEventId() === id) this.closeMilestonePanel();
  }
}
