import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dateOnlyInTimezone, localPartsToUtcIso } from '../../../../shared/utils/timezone.util';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse } from '../../../calendar/models/calendar-event.model';
import { MyTasksApiService } from '../../data-access/my-tasks-api.service';
import { MyTaskItem } from '../../models/my-tasks.model';

const MAX_AGENDA_ITEMS = 5;
/** Meetings first, then tasks up to this many rows in all. */
const MAX_ROWS = 6;

export type ScheduleTaskStatus = 'overdue' | 'due';

export type ScheduleItemStatus = 'completed' | 'inProgress' | 'upcoming';

const STATUS_LABELS: Record<ScheduleItemStatus, string> = {
  completed: 'Completed',
  inProgress: 'In Progress',
  upcoming: 'Upcoming'
};

export type ScheduleEventKind = 'team' | 'code' | 'chat' | 'doc' | 'calendar';

/** Row icon by the event's title; the first matching rule wins, otherwise the calendar icon. */
const KIND_RULES: readonly (readonly [ScheduleEventKind, RegExp])[] = [
  ['team', /\b(stand-?up|sync|huddle|team)\b/i],
  ['code', /\b(review|pr|code|deploy|release)\b/i],
  ['chat', /\b(discussion|discuss|chat|brainstorm)\b/i],
  ['doc', /\b(client|customer|meeting|call|interview)\b/i]
];

/** Icon tile colours per kind (Tailwind classes). */
const KIND_TILE: Record<ScheduleEventKind, string> = {
  team: 'bg-blue-50 text-blue-600',
  code: 'bg-indigo-50 text-indigo-600',
  chat: 'bg-emerald-100 text-emerald-600',
  doc: 'bg-slate-100 text-slate-600',
  calendar: 'bg-slate-100 text-slate-600'
};

export function scheduleEventKind(title: string): ScheduleEventKind {
  return KIND_RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? 'calendar';
}

@Component({
  selector: 'app-todays-schedule-card',
  standalone: true,
  imports: [RouterLink],
  // A size container: the row layout follows the card's own width (Small / Large on the grid).
  host: { class: '@container block' },
  templateUrl: './todays-schedule-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodaysScheduleCardComponent implements OnInit {
  private readonly api = inject(CalendarEventApiService);
  private readonly authStore = inject(AuthStore, { optional: true });

  private readonly tasksApi = inject(MyTasksApiService);

  private readonly rawEvents = signal<readonly CalendarEventResponse[]>([]);
  private readonly rawTasks = signal<readonly MyTaskItem[]>([]);
  protected readonly loading = signal(true);

  protected readonly agendaItems = computed(() => {
    const now = Date.now();
    return [...this.rawEvents()]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .map((event) => ({ event, status: scheduleItemStatus(event, now), kind: scheduleEventKind(event.title) }))
      .slice(0, MAX_AGENDA_ITEMS);
  });

  /** Active tasks due today or overdue (overdue first), filling the rows the meetings leave. */
  protected readonly taskItems = computed(() =>
    [...this.rawTasks()]
      .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || a.dueDate.localeCompare(b.dueDate))
      .map((task) => ({ task, status: (task.isOverdue ? 'overdue' : 'due') as ScheduleTaskStatus }))
      .slice(0, Math.max(0, MAX_ROWS - this.agendaItems().length))
  );

  protected readonly hiddenTaskCount = computed(() => this.rawTasks().length - this.taskItems().length);
  protected readonly isEmpty = computed(() => this.agendaItems().length === 0 && this.rawTasks().length === 0);

  ngOnInit(): void {
    // upcomingDays = 0: tasks due today, plus overdue ones.
    this.tasksApi.getMyTasks(0).subscribe({
      next: (response) => this.rawTasks.set(response.tasks ?? []),
      error: () => this.rawTasks.set([])
    });
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
    return compactTimeRange(new Date(event.startDate), new Date(event.endDate));
  }

  protected taskLink(task: MyTaskItem): string[] {
    return ['/work', task.projectId, 'board'];
  }

  protected statusLabel(status: ScheduleItemStatus): string {
    return STATUS_LABELS[status];
  }

  protected kindTileClass(kind: ScheduleEventKind): string {
    return KIND_TILE[kind];
  }

  /** Second line of a row: the description, else the place (the time range has its own column). */
  protected subtitle(event: CalendarEventResponse): string | null {
    return event.description?.trim() || this.getPhysicalLocation(event);
  }

  private loadTodaysEvents(timezone: string): void {
    const today = dateOnlyInTimezone(new Date().toISOString(), timezone);
    const from = localPartsToUtcIso(today, '00:00', timezone);
    const to = localPartsToUtcIso(today, '23:59', timezone);

    this.api.getEvents(from, to).subscribe({
      next: (response) => {
        this.rawEvents.set(response.events);
        this.loading.set(false);
      },
      error: () => {
        this.rawEvents.set([]);
        this.loading.set(false);
      }
    });
  }
}

/** Completed once it has ended, In Progress while it runs, Upcoming before it starts. All-day
 * events count as In Progress for the whole day. */
export function scheduleItemStatus(event: CalendarEventResponse, now: number): ScheduleItemStatus {
  if (event.isAllDay) return 'inProgress';
  const start = new Date(event.startDate).getTime();
  const end = new Date(event.endDate).getTime();
  if (end <= now && end > start) return 'completed';
  if (start <= now && now < end) return 'inProgress';
  return start > now ? 'upcoming' : 'completed';
}

/** "09:00 – 09:30 AM" when both ends share AM/PM, otherwise "11:30 AM – 12:30 PM". */
export function compactTimeRange(start: Date, end: Date): string {
  const startLabel = formatEventTimeLabel(start.toISOString(), false);
  const endLabel = formatEventTimeLabel(end.toISOString(), false);
  const [startTime, startHalf] = startLabel.split(' ');
  const endHalf = endLabel.split(' ')[1];
  return startHalf === endHalf ? `${startTime} – ${endLabel}` : `${startLabel} – ${endLabel}`;
}

function formatEventTimeLabel(iso: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day';
  return new Date(iso)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .replace(/\u202f/g, ' ');
}
