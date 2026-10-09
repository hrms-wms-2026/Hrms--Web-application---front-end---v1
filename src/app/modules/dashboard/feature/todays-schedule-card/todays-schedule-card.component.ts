import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dateOnlyInTimezone, localPartsToUtcIso } from '../../../../shared/utils/timezone.util';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse } from '../../../calendar/models/calendar-event.model';

const MAX_AGENDA_ITEMS = 4;
const FALLBACK_DOT_COLORS: readonly string[] = [
  'var(--color-accent)',
  'var(--color-text-primary)',
  'var(--color-warning)',
  'var(--color-success)'
];

@Component({
  selector: 'app-todays-schedule-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './todays-schedule-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodaysScheduleCardComponent implements OnInit {
  private readonly api = inject(CalendarEventApiService);
  private readonly authStore = inject(AuthStore, { optional: true });

  private readonly rawEvents = signal<readonly CalendarEventResponse[]>([]);
  protected readonly loading = signal(true);

  protected readonly agendaItems = computed(() => {
    const now = Date.now();
    return [...this.rawEvents()]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .map((event) => ({ event, isUpcoming: new Date(event.startDate).getTime() >= now }))
      .slice(0, MAX_AGENDA_ITEMS);
  });

  protected readonly nextUp = computed(
    () => this.agendaItems().find((item) => item.isUpcoming)?.event ?? (this.agendaItems()[0]?.event ?? null)
  );

  protected readonly remainingItems = computed(() => {
    const next = this.nextUp();
    if (!next) return this.agendaItems();
    return this.agendaItems().filter((item) => item.event.id !== next.id);
  });

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

  protected dotColor(event: CalendarEventResponse, index = 0): string {
    return event.color || FALLBACK_DOT_COLORS[index % FALLBACK_DOT_COLORS.length];
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

function formatEventTimeLabel(iso: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day';
  return new Date(iso)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .replace(/\u202f/g, ' ');
}
