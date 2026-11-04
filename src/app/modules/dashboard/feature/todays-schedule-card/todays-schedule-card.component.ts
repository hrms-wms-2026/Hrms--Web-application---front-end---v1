import { NgTemplateOutlet } from '@angular/common';
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

@Component({
  selector: 'app-todays-schedule-card',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, KeyboardClickDirective, MeetingOccurrenceDrawerComponent],
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

  /** Everything listed today: the meetings plus the calendar events. */
  protected readonly totalItemsCount = computed(() => this.todaysMeetings().length + this.agendaItems().length);

  /** Today's meetings plus the calendar events that carry a meeting link. */
  protected readonly meetingsCount = computed(() =>
    this.todaysMeetings().length + this.agendaItems().filter((item) => this.itemKind(item.event) === 'Meeting').length);

  /** Calendar events without a meeting link. */
  protected readonly eventsCount = computed(() =>
    this.agendaItems().filter((item) => this.itemKind(item.event) === 'Event').length);

  /** Total scheduled time formatted, e.g. "8h" or "2h 30m" */
  protected readonly totalTimeLabel = computed(() => {
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

  protected itemKind(event: CalendarEventResponse): AgendaItemKind {
    return event.itemKind === 'meeting' || this.getMeetingLink(event) ? 'Meeting' : 'Event';
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
