import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { dateOnlyInTimezone, localPartsToUtcIso } from '../../../../shared/utils/timezone.util';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse } from '../../../calendar/models/calendar-event.model';
import { MeetingApiService } from '../../../work/meetings/data-access/meeting-api.service';
import { MeetingOccurrenceDrawerComponent } from '../../../work/meetings/feature/meeting-occurrence-drawer/meeting-occurrence-drawer.component';
import { MeetingListItem } from '../../../work/meetings/models/meeting.models';
import { MeetingJoinLink, joinLinkOf } from '../../../work/meetings/utils/meeting-join-link';

export { joinLinkOf };
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { PlannerRangeBlockView } from '../../../work/planner/models/planner.models';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';

const MAX_AGENDA_ITEMS = 5;

export type ScheduleItemStatus = 'completed' | 'inProgress' | 'upcoming';

const STATUS_META: Record<ScheduleItemStatus, {
  label: string; chip: string; dot: string; node: string; rail: string; card: string; step: string;
}> = {
  completed: {
    label: 'Completed', chip: 'bg-[var(--color-success-subtle)] text-[var(--color-success-text)]', dot: '#10b981',
    node: 'bg-[var(--color-success)] text-[var(--color-text-on-solid)] shadow-xs font-bold', rail: 'bg-[var(--color-success)]',
    card: 'border-[var(--color-border)]/80 bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:shadow-xs', step: 'Completed step'
  },
  inProgress: {
    label: 'In progress', chip: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]', dot: '#2563eb',
    node: 'bg-[var(--color-accent)] text-[var(--color-text-on-solid)] shadow-xs font-bold', rail: 'bg-[var(--color-accent)]',
    card: 'border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)]/40 shadow-xs', step: 'In progress step'
  },
  upcoming: {
    label: 'Upcoming', chip: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]', dot: '#94a3b8',
    node: 'border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-[var(--color-text-primary)] shadow-2xs', rail: 'bg-[var(--color-border)]',
    card: 'border-[var(--color-border)]/80 bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:shadow-xs', step: 'Step'
  }
};

/** A calendar event with a meeting link is a Meeting; any other calendar event is an Event. Never guessed from the title. */
export type AgendaItemKind = 'Meeting' | 'Event';

interface TimelineRowBase {
  readonly key: string;
  readonly start: number;
  readonly end: number;
  readonly title: string;
  readonly allDay: boolean;
  readonly status: ScheduleItemStatus;
}

/** One row of the day: a meeting, a calendar event or a task block from the planner. */
type TimelineRow = TimelineRowBase & (
  | { readonly kind: 'meeting'; readonly meeting: MeetingListItem }
  | { readonly kind: 'event'; readonly event: CalendarEventResponse }
  | { readonly kind: 'task'; readonly block: PlannerRangeBlockView }
);

@Component({
  selector: 'app-todays-schedule-card',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, KeyboardClickDirective, StopClickPropagationDirective,MeetingOccurrenceDrawerComponent, PopoutHeaderActionsComponent, TaskFormModalComponent],
  // A size container: the row layout follows the card's own width (Small / Large on the grid).
  host: { class: '@container block' },
  templateUrl: './todays-schedule-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodaysScheduleCardComponent implements OnInit {
  private readonly api = inject(CalendarEventApiService);
  private readonly authStore = inject(AuthStore, { optional: true });

  private readonly meetings = inject(MeetingApiService);
  private readonly planner = inject(PlannerApiService);
  private readonly projects = inject(ProjectDetailStore);
  private readonly router = inject(Router);

  private readonly rawEvents = signal<readonly CalendarEventResponse[]>([]);
  private readonly rawMeetings = signal<readonly MeetingListItem[]>([]);
  private readonly rawBlocks = signal<readonly PlannerRangeBlockView[]>([]);
  private readonly todayWindow = signal<{ from: string; to: string } | null>(null);
  protected readonly loading = signal(true);
  /** A refresh from the header button: the list stays on screen while it reloads. */
  protected readonly refreshing = signal(false);
  protected readonly openMeeting = signal<{ seriesId: string; originalStart: string } | null>(null);
  /** The planned task shown in the task popup, right here on the dashboard. */
  protected readonly openedTask = signal<{ projectId: string; taskId: string } | null>(null);
  /** Teams/Zoom join links of today's meetings, by series. */
  private readonly joinLinks = signal<Record<string, MeetingJoinLink | undefined>>({});

  /** Today's meetings-as-tasks occurrences, in chronological start and end order; a cancelled one is left out. */
  protected readonly todaysMeetings = computed(() => {
    const window = this.todayWindow();
    if (!window) return [];
    const from = Date.parse(window.from);
    const to = Date.parse(window.to);
    return this.rawMeetings()
      .filter((m) => m.status !== 'cancelled' && Date.parse(m.startAt) >= from && Date.parse(m.startAt) <= to)
      .sort((a, b) => {
        const startDiff = Date.parse(a.startAt) - Date.parse(b.startAt);
        if (startDiff !== 0) return startDiff;
        const endDiff = Date.parse(a.endAt) - Date.parse(b.endAt);
        if (endDiff !== 0) return endDiff;
        return a.title.localeCompare(b.title);
      });
  });

  protected readonly agendaItems = computed(() => {
    const now = Date.now();
    // A task meeting also comes back on the calendar feed (itemKind "meeting"); it is listed once, under Today's meetings.
    return this.rawEvents().filter((event) => event.itemKind !== 'meeting')
      .sort((a, b) => {
        const startDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (startDiff !== 0) return startDiff;
        const endDiff = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        if (endDiff !== 0) return endDiff;
        return (a.title || '').localeCompare(b.title || '');
      })
      .map((event) => ({ event, status: scheduleItemStatus(event, now) }))
      .slice(0, MAX_AGENDA_ITEMS);
  });

  /** The whole day in one list, in time order: meetings, calendar events and planned task blocks. */
  protected readonly timeline = computed<readonly TimelineRow[]>(() => {
    const now = Date.now();
    const rows: TimelineRow[] = [
      ...this.todaysMeetings().map((meeting): TimelineRow => ({
        kind: 'meeting', key: `meeting-${meeting.taskId}`, meeting, title: this.meetingTitle(meeting), allDay: meeting.isAllDay,
        start: Date.parse(meeting.startAt), end: Date.parse(meeting.endAt), status: this.meetingStatus(meeting)
      })),
      ...this.agendaItems().map(({ event, status }): TimelineRow => ({
        kind: 'event', key: `event-${event.id}`, event, title: event.title || '', allDay: event.isAllDay,
        start: Date.parse(event.startDate), end: Date.parse(event.endDate), status
      })),
      ...this.rawBlocks().map((block): TimelineRow => ({
        kind: 'task', key: `task-${block.id}`, block, title: block.taskTitle, allDay: false,
        start: Date.parse(block.startAt), end: Date.parse(block.endAt), status: timeStatus(Date.parse(block.startAt), Date.parse(block.endAt), now)
      })),
    ];
    return rows.sort((a, b) => a.start - b.start || a.end - b.end || a.title.localeCompare(b.title));
  });

  /** Everything listed today. */
  protected readonly totalItemsCount = computed(() => this.timeline().length);

  /** Planned task blocks. */
  protected readonly tasksCount = computed(() => this.rawBlocks().length);

  /** Today's meetings plus the calendar events that carry a meeting link. */
  protected readonly meetingsCount = computed(() =>
    this.todaysMeetings().length + this.agendaItems().filter((item) => this.itemKind(item.event) === 'Meeting').length);

  /** Calendar events without a meeting link. */
  protected readonly eventsCount = computed(() =>
    this.agendaItems().filter((item) => this.itemKind(item.event) === 'Event').length);

  /** Scheduled time formatted, e.g. "8h" or "2h 30m". Overlapping items count once, as the planner's "Planned" does. */
  protected readonly totalTimeLabel = computed(() => {
    const totalMinutes = Math.round(busyMilliseconds(this.timeline().filter((row) => !row.allDay)) / 60_000);
    if (totalMinutes <= 0) return '0m';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  });

  protected meetingStatus(meeting: MeetingListItem): ScheduleItemStatus {
    const now = Date.now();
    const start = new Date(meeting.startAt).getTime();
    const end = new Date(meeting.endAt).getTime();
    if (meeting.status === 'completed' || (end <= now && end > start)) return 'completed';
    if (meeting.status === 'in_progress' || (start <= now && now < end)) return 'inProgress';
    return start > now ? 'upcoming' : 'completed';
  }

  protected meetingTitle(meeting: MeetingListItem): string {
    return meeting.isPrivate && !meeting.myRole ? 'Private meeting' : meeting.title;
  }

  protected taskTimeRange(block: PlannerRangeBlockView): string {
    return `${formatEventTimeLabel(block.startAt, false)} – ${formatEventTimeLabel(block.endAt, false)}`;
  }

  protected meetingTimeRange(meeting: MeetingListItem): string {
    if (meeting.isAllDay) return 'All day';
    const start = formatEventTimeLabel(meeting.startAt, false);
    const end = formatEventTimeLabel(meeting.endAt, false);
    return `${start} – ${end}`;
  }

  protected itemKind(event: CalendarEventResponse): AgendaItemKind {
    return event.itemKind === 'meeting' || this.getMeetingLink(event) ? 'Meeting' : 'Event';
  }

  ngOnInit(): void {
    this.load();
  }

  /** The meeting's Teams/Zoom link, shown as Join while hovering the row; null when it has none or it has ended. */
  protected meetingJoin(meeting: MeetingListItem): MeetingJoinLink | null {
    if (meeting.status === 'cancelled' || this.meetingStatus(meeting) === 'completed') return null;
    return this.joinLinks()[meeting.seriesId] ?? null;
  }

  /** Each of today's series' links, fetched up front so Join is a plain link the browser opens in the meeting app. */
  private loadJoinLinks(items: readonly MeetingListItem[]): void {
    const seriesIds = [...new Set(items.filter((m) => m.status !== 'cancelled' && (!m.isPrivate || m.myRole)).map((m) => m.seriesId))];
    if (!seriesIds.length) {
      this.joinLinks.set({});
      return;
    }
    forkJoin(seriesIds.map((seriesId) => this.meetings.getLink(seriesId).pipe(
      map((response): [string, MeetingJoinLink | null] => [seriesId, joinLinkOf(response)]),
      catchError(() => of<[string, MeetingJoinLink | null]>([seriesId, null]))
    ))).subscribe((pairs) => {
      const links: Record<string, MeetingJoinLink | undefined> = {};
      for (const [seriesId, link] of pairs) if (link) links[seriesId] = link;
      this.joinLinks.set(links);
    });
  }

  /** Opens a planned task in the task popup over the dashboard. The popup reads its project from
   * ProjectDetailStore (as the calendar's does); if that project can't load, the board opens instead. */
  protected async openTask(block: PlannerRangeBlockView): Promise<void> {
    const { projectId, taskId } = block;
    await this.projects.loadProject(projectId);
    if (this.projects.projectError()) {
      void this.router.navigate(['/work', projectId, 'board'], { queryParams: { taskId } });
      return;
    }
    await this.projects.loadMyMilestones(projectId);
    this.openedTask.set({ projectId, taskId });
  }

  protected refresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.load();
  }

  private load(): void {
    this.api.getMyTimezone().subscribe({
      next: ({ timezone }) => this.loadTodaysEvents(timezone),
      error: () => this.loadTodaysEvents('UTC')
    });
  }

  protected isOrganizer(event: CalendarEventResponse): boolean {
    if (typeof event.isOrganizer === 'boolean') {
      return event.isOrganizer;
    }
    const myId = this.authStore?.employeeId?.();
    return !!(myId && event.createdById === myId);
  }

  protected getMeetingLink(event: CalendarEventResponse): string | null {
    if (event.meetingLink && event.meetingLink.trim()) {
      const link = event.meetingLink.trim();
      return link.startsWith('http') ? link : `https://${link}`;
    }
    if (event.location && (event.location.startsWith('http://') || event.location.startsWith('https://'))) {
      return event.location.trim();
    }
    return null;
  }

  protected getMeetingPlatform(event: CalendarEventResponse): 'zoom' | 'teams' | 'meet' | 'video' {
    const raw = `${event.meetingLink || ''} ${event.location || ''}`.toLowerCase();
    if (raw.includes('zoom')) return 'zoom';
    if (raw.includes('teams') || raw.includes('microsoft')) return 'teams';
    if (raw.includes('meet.google') || raw.includes('google meet')) return 'meet';
    return 'video';
  }

  protected getMeetingPlatformLabel(event: CalendarEventResponse): string {
    const platform = this.getMeetingPlatform(event);
    switch (platform) {
      case 'zoom': return 'Zoom';
      case 'teams': return 'Teams';
      case 'meet': return 'Google Meet';
      default: return 'Video Call';
    }
  }

  protected getPhysicalLocation(event: CalendarEventResponse): string | null {
    if (!event.location) return null;
    const loc = event.location.trim();
    if (loc.startsWith('http://') || loc.startsWith('https://')) return null;
    // If location is just 'zoom' or 'teams' and we already have a meeting link, don't duplicate
    const lower = loc.toLowerCase();
    if ((lower === 'zoom' || lower === 'teams' || lower === 'google meet') && this.getMeetingLink(event)) {
      return null;
    }
    return loc;
  }

  protected timeLabel(event: CalendarEventResponse): string {
    return formatEventTimeLabel(event.startDate, event.isAllDay);
  }

  protected timeRangeLabel(event: CalendarEventResponse): string {
    if (event.isAllDay) return 'All day';
    const start = formatEventTimeLabel(event.startDate, false);
    const end = formatEventTimeLabel(event.endDate, false);
    return `${start} – ${end}`;
  }

  protected statusLabel(status: ScheduleItemStatus): string {
    return STATUS_META[status].label;
  }

  protected statusChipClass(status: ScheduleItemStatus): string {
    return STATUS_META[status].chip;
  }

  protected statusDotColor(status: ScheduleItemStatus): string {
    return STATUS_META[status].dot;
  }

  protected stepNodeClass(status: ScheduleItemStatus): string {
    return STATUS_META[status].node;
  }

  protected stepAriaLabel(status: ScheduleItemStatus, step: number): string {
    return `${STATUS_META[status].step} ${step}`;
  }

  protected railClass(status: ScheduleItemStatus): string {
    return STATUS_META[status].rail;
  }

  protected cardClass(status: ScheduleItemStatus): string {
    return STATUS_META[status].card;
  }

  /** Second line of a row: the description, else the place, else the time range. */
  protected subtitle(event: CalendarEventResponse): string {
    return event.description?.trim() || this.getPhysicalLocation(event) || this.timeRangeLabel(event);
  }

  private loadTodaysEvents(timezone: string): void {
    const today = dateOnlyInTimezone(new Date().toISOString(), timezone);
    const from = localPartsToUtcIso(today, '00:00', timezone);
    const to = localPartsToUtcIso(today, '23:59', timezone);
    this.todayWindow.set({ from, to });
    this.meetings.list(from, to).subscribe({
      next: (items) => {
        this.rawMeetings.set(items);
        this.loadJoinLinks(items);
      },
      error: () => this.rawMeetings.set([])
    });

    // Together, so a day of only planned tasks never flashes the empty state. Each source fails on its own: the
    // planner answers 503 when it is off, and the card is then the plain calendar.
    forkJoin({
      events: this.api.getEvents(from, to).pipe(map((response) => response.events), catchError(() => of<readonly CalendarEventResponse[]>([]))),
      blocks: this.planner.getRange(today, today).pipe(
        map((range) => range.days.find((day) => day.date === today)?.blocks ?? []),
        catchError(() => of<readonly PlannerRangeBlockView[]>([]))
      )
    }).subscribe(({ events, blocks }) => {
      this.rawEvents.set(events);
      this.rawBlocks.set(blocks);
      this.loading.set(false);
      this.refreshing.set(false);
    });
  }
}

/** Completed once it has ended, In Progress while it runs, Upcoming before it starts. All-day
 * events count as In Progress for the whole day. */
export function scheduleItemStatus(event: CalendarEventResponse, now: number): ScheduleItemStatus {
  if (event.isAllDay) return 'inProgress';
  return timeStatus(new Date(event.startDate).getTime(), new Date(event.endDate).getTime(), now);
}

function timeStatus(start: number, end: number, now: number): ScheduleItemStatus {
  if (end <= now && end > start) return 'completed';
  if (start <= now && now < end) return 'inProgress';
  return start > now ? 'upcoming' : 'completed';
}

/** The time covered by at least one range: overlaps count once. */
function busyMilliseconds(ranges: readonly { start: number; end: number }[]): number {
  let total = 0;
  let coveredTo = -Infinity;
  for (const { start, end } of [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)) {
    const from = Math.max(start, coveredTo);
    if (end > from) {
      total += end - from;
      coveredTo = end;
    }
  }
  return total;
}

function formatEventTimeLabel(iso: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day';
  return new Date(iso)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .replace(/\u202f/g, ' ');
}
