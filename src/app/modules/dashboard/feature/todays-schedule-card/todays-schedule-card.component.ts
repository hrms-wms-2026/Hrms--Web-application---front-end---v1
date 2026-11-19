import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dateOnlyInTimezone, localPartsToUtcIso } from '../../../../shared/utils/timezone.util';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse } from '../../../calendar/models/calendar-event.model';
import { MeetingApiService } from '../../../work/meetings/data-access/meeting-api.service';
import { MeetingOccurrenceDrawerComponent } from '../../../work/meetings/feature/meeting-occurrence-drawer/meeting-occurrence-drawer.component';
import { MeetingListItem } from '../../../work/meetings/models/meeting.models';

const MAX_AGENDA_ITEMS = 5;

export type ScheduleItemStatus = 'completed' | 'inProgress' | 'upcoming';

const STATUS_META: Record<ScheduleItemStatus, { label: string; chip: string; dot: string }> = {
  completed: { label: 'Completed', chip: 'bg-emerald-50 text-emerald-700', dot: '#10b981' },
  inProgress: { label: 'In progress', chip: 'bg-blue-50 text-blue-700', dot: '#2563eb' },
  upcoming: { label: 'Upcoming', chip: 'bg-slate-100 text-slate-600', dot: '#94a3b8' }
};

export interface DemoScheduleItem {
  id: string;
  step: number;
  title: string;
  timeRange: string;
  kind: 'Meeting' | 'Task';
  subtitle: string;
  status: ScheduleItemStatus;
}

export type ScheduleEntry =
  | {
      id: string;
      kind: 'meeting';
      meeting: MeetingListItem;
      startMs: number;
      endMs: number;
      status: ScheduleItemStatus;
    }
  | {
      id: string;
      kind: 'event';
      event: CalendarEventResponse;
      startMs: number;
      endMs: number;
      status: ScheduleItemStatus;
    };

export const DEMO_SCHEDULE_ITEMS: DemoScheduleItem[] = [
  { id: 'd1', step: 1, title: 'meeting A', timeRange: '01:45 AM – 02:45 AM', kind: 'Meeting', subtitle: 'OFFICE-M1', status: 'completed' },
  { id: 'd2', step: 2, title: 'meeting B', timeRange: '02:45 AM – 04:00 AM', kind: 'Meeting', subtitle: 'HWPORTAL-M12', status: 'completed' },
  { id: 'd3', step: 3, title: 'meeting b', timeRange: '02:45 AM – 04:15 AM', kind: 'Meeting', subtitle: 'OFFICE-M2', status: 'inProgress' },
  { id: 'd4', step: 4, title: 'demo 2', timeRange: '09:15 AM – 10:45 AM', kind: 'Meeting', subtitle: 'WCRAFT-M1', status: 'upcoming' },
  { id: 'd5', step: 5, title: 'sprint review meeting', timeRange: '01:00 PM – 01:30 PM', kind: 'Meeting', subtitle: 'HWPORTAL-M13', status: 'upcoming' },
  { id: 'd6', step: 6, title: 'demo shantha', timeRange: '03:30 PM – 05:45 PM', kind: 'Meeting', subtitle: 'ONEXSO-M1', status: 'upcoming' },
];

@Component({
  selector: 'app-todays-schedule-card',
  standalone: true,
  imports: [RouterLink, KeyboardClickDirective, MeetingOccurrenceDrawerComponent],
  // A size container: the row layout follows the card's own width (Small / Large on the grid).
  host: { class: '@container block' },
  templateUrl: './todays-schedule-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodaysScheduleCardComponent implements OnInit {
  private readonly api = inject(CalendarEventApiService);
  private readonly authStore = inject(AuthStore, { optional: true });

  private readonly meetings = inject(MeetingApiService);

  private readonly rawEvents = signal<readonly CalendarEventResponse[]>([]);
  private readonly rawMeetings = signal<readonly MeetingListItem[]>([]);
  private readonly todayWindow = signal<{ from: string; to: string } | null>(null);
  protected readonly loading = signal(true);
  protected readonly openMeeting = signal<{ seriesId: string; originalStart: string } | null>(null);

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

  protected readonly showDemoItems = signal(false);
  protected readonly demoItems = DEMO_SCHEDULE_ITEMS;

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

  /** Unified list of all today's items (meetings and events) in chronological ascending order */
  protected readonly allScheduleItems = computed<readonly ScheduleEntry[]>(() => {
    const list: ScheduleEntry[] = [];

    for (const m of this.todaysMeetings()) {
      list.push({
        id: `meeting-${m.taskId}`,
        kind: 'meeting',
        meeting: m,
        startMs: Date.parse(m.startAt),
        endMs: Date.parse(m.endAt),
        status: this.meetingStatus(m)
      });
    }

    for (const item of this.agendaItems()) {
      list.push({
        id: `event-${item.event.id}`,
        kind: 'event',
        event: item.event,
        startMs: new Date(item.event.startDate).getTime(),
        endMs: new Date(item.event.endDate).getTime(),
        status: item.status
      });
    }

    return list.sort((a, b) => {
      const startDiff = a.startMs - b.startMs;
      if (startDiff !== 0) return startDiff;

      const endDiff = a.endMs - b.endMs;
      if (endDiff !== 0) return endDiff;

      const titleA = a.kind === 'meeting' ? a.meeting.title : (a.event.title || '');
      const titleB = b.kind === 'meeting' ? b.meeting.title : (b.event.title || '');
      return titleA.localeCompare(titleB);
    });
  });

  /** Total scheduled items count (meetings + agenda items) */
  protected readonly totalItemsCount = computed(() => {
    if (this.showDemoItems()) return 6;
    return this.allScheduleItems().length;
  });

  /** Total meetings count today */
  protected readonly meetingsCount = computed(() => {
    if (this.showDemoItems()) return 6;
    const agendaMeetings = this.agendaItems().filter(
      (item) => this.getItemKind(item.event) === 'Meeting'
    ).length;
    return this.todaysMeetings().length + agendaMeetings;
  });

  /** Total tasks/events count today */
  protected readonly tasksCount = computed(() => {
    if (this.showDemoItems()) return 0;
    return this.agendaItems().filter(
      (item) => this.getItemKind(item.event) === 'Task'
    ).length;
  });

  /** Total scheduled time formatted, e.g. "8h" or "2h 30m" */
  protected readonly totalTimeLabel = computed(() => {
    if (this.showDemoItems()) return '8h';
    let totalMinutes = 0;

    for (const m of this.todaysMeetings()) {
      if (m.startAt && m.endAt && !m.isAllDay) {
        const start = new Date(m.startAt).getTime();
        const end = new Date(m.endAt).getTime();
        if (end > start) {
          totalMinutes += Math.round((end - start) / 60_000);
        }
      }
    }

    for (const item of this.agendaItems()) {
      const e = item.event;
      if (e.startDate && e.endDate && !e.isAllDay) {
        const start = new Date(e.startDate).getTime();
        const end = new Date(e.endDate).getTime();
        if (end > start) {
          totalMinutes += Math.round((end - start) / 60_000);
        }
      }
    }

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

  protected meetingTimeRange(meeting: MeetingListItem): string {
    if (meeting.isAllDay) return 'All day';
    const start = formatEventTimeLabel(meeting.startAt, false);
    const end = formatEventTimeLabel(meeting.endAt, false);
    return `${start} – ${end}`;
  }

  protected getItemKind(event: CalendarEventResponse): 'Meeting' | 'Task' {
    if (event.itemKind === 'meeting' || event.meetingLink || this.getMeetingLink(event)) {
      return 'Meeting';
    }
    const title = (event.title || '').toLowerCase();
    if (
      title.includes('meeting') ||
      title.includes('standup') ||
      title.includes('sync') ||
      title.includes('review') ||
      title.includes('1:1') ||
      title.includes('call') ||
      title.includes('planning') ||
      title.includes('retro')
    ) {
      return 'Meeting';
    }
    return 'Task';
  }

  ngOnInit(): void {
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
      next: (items) => this.rawMeetings.set(items),
      error: () => this.rawMeetings.set([])
    });

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

function formatEventTimeLabel(iso: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day';
  return new Date(iso)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .replace(/\u202f/g, ' ');
}
