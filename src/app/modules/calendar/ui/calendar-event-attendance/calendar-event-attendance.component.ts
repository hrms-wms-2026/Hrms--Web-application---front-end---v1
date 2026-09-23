import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { MeetingAttendeeResponse } from '../../models/calendar-event.model';

@Component({
  selector: 'app-calendar-event-attendance',
  standalone: true,
  imports: [],
  template: `
    @if (available()) {
      <div class="flex flex-col gap-1">
        @for (attendee of attendees(); track attendee.email ?? attendee.name ?? attendee.joinedAt) {
          <div data-testid="calendar-attendance-row" class="flex items-center justify-between text-xs">
            <span class="truncate">{{ attendee.name ?? attendee.email ?? 'Unknown participant' }}</span>
            <span class="shrink-0 text-[var(--color-text-secondary)]">{{ formatDuration(attendee.durationSeconds) }}</span>
          </div>
        }
      </div>
    } @else {
      <p data-testid="calendar-attendance-unavailable" class="text-xs text-[var(--color-text-secondary)]">
        Attendance data unavailable
      </p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventAttendanceComponent implements OnInit {
  private readonly api = inject(CalendarEventApiService);

  eventId = input.required<string>();
  protected readonly available = signal(false);
  protected readonly attendees = signal<readonly MeetingAttendeeResponse[]>([]);

  ngOnInit(): void {
    this.api.getMeetingAttendance(this.eventId()).subscribe((response) => {
      this.available.set(response.available);
      this.attendees.set(response.attendees);
    });
  }

  protected formatDuration(seconds: number | null): string {
    if (seconds === null) return '';
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }
}
