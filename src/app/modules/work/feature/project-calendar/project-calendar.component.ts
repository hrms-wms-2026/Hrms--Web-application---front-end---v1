import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { addCalendarDays, calendarDayDifference, calendarRange } from '../../utils/calendar-date.utils';

@Component({
  selector: 'app-project-calendar',
  standalone: true,
  imports: [ObjectiveTimelineBarComponent, CalendarEventModalComponent, CalendarEventLegendComponent],
  template: `
    <section class="space-y-4 p-4" data-testid="project-calendar">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Project calendar</p>
          <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">Objective timeline</h1>
          <p class="text-sm text-[var(--color-text-secondary)]">Drag an editable bar to shift it, or use its edges to resize the date range.</p>
        </div>
        <button type="button" class="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" [disabled]="store.loading() || !store.items().length" (click)="openCreateEvent()">Create event</button>
      </header>

      @if (store.error()) {
        <div class="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]" role="alert">{{ store.error() }}</div>
      }
      @if (store.loading()) {
        <div class="rounded-lg border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading calendar…</div>
      } @else if (!store.items().length) {
        <div class="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-secondary)]">No objectives are available for this project.</div>
      } @else {
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div class="min-w-0 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div class="min-w-[900px]">
              <div class="grid border-b border-[var(--color-border)]" [style.gridTemplateColumns]="'220px 1fr'">
                <div class="p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Objective</div>
                <div class="relative h-12" [style.width.px]="timelineWidth()">
                  @for (day of days(); track day) {
                    <div class="absolute top-0 h-full border-l border-[var(--color-border)]/60 px-1 pt-3 text-[10px] text-[var(--color-text-secondary)]" [style.left.px]="dayIndex(day) * DAY_WIDTH">{{ day.slice(5) }}</div>
                  }
                </div>
              </div>
              @for (item of store.items(); track item.objectiveId) {
                <div class="grid border-b border-[var(--color-border)] last:border-b-0" [style.gridTemplateColumns]="'220px 1fr'" [attr.data-testid]="'calendar-row-' + item.objectiveId">
                  <div class="min-w-0 p-3">
                    <div class="truncate text-sm font-medium text-[var(--color-text-primary)]" [title]="item.title">{{ item.title }}</div>
                    <div class="mt-1 text-xs text-[var(--color-text-secondary)]">{{ item.startDate }} → {{ item.endDate }}</div>
                  </div>
                  <div class="relative h-16" [style.width.px]="timelineWidth()">
                    <div class="absolute inset-0 opacity-50" [style.background]="gridBackground()"></div>
                    <app-objective-timeline-bar
                      [item]="item"
                      [timelineStart]="timelineStart()"
                      [dayWidth]="DAY_WIDTH"
                      [saving]="store.saving()"
                      [pendingApproval]="store.pendingSet().has(item.objectiveId)"
                      [approvalMessage]="store.approvalMessages()[item.objectiveId] || 'Needs approval before this date change can be applied.'"
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
  `
})
export class ProjectCalendarComponent implements OnInit {
  readonly store = inject(ProjectCalendarStore);
  private readonly route = inject(ActivatedRoute);
  readonly DAY_WIDTH = 28;
  readonly modalOpen = signal(false);
  readonly editingEvent = signal<CalendarEventDto | null>(null);
  readonly projectId = signal<string | null>(null);

  readonly timelineStart = computed(() => {
    const dates = this.store.items().map((item) => item.startDate).filter(Boolean).sort();
    return dates[0] ?? new Date().toISOString().slice(0, 10);
  });
  readonly timelineEnd = computed(() => {
    const dates = this.store.items().map((item) => item.endDate).filter(Boolean).sort();
    return dates.at(-1) ?? addCalendarDays(this.timelineStart(), 30);
  });
  readonly days = computed(() => calendarRange(this.timelineStart(), this.timelineEnd()));
  readonly timelineWidth = computed(() => Math.max(1, this.days().length) * this.DAY_WIDTH);

  ngOnInit(): void {
    const id = this.route.snapshot.parent?.paramMap.get('id') ?? this.route.snapshot.paramMap.get('id');
    if (id) {
      this.projectId.set(id);
      void this.store.load(id);
    }
  }

  dayIndex(day: string): number {
    return calendarDayDifference(this.timelineStart(), day);
  }

  gridBackground(): string {
    return `repeating-linear-gradient(to right, transparent 0, transparent ${this.DAY_WIDTH - 1}px, var(--color-border) ${this.DAY_WIDTH - 1}px, var(--color-border) ${this.DAY_WIDTH}px)`;
  }

  async saveDates(change: CalendarDateChange): Promise<void> {
    await this.store.saveDates(change);
  }

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

  async closeEvent(id: string): Promise<void> {
    await this.store.closeEvent(id);
  }
}
