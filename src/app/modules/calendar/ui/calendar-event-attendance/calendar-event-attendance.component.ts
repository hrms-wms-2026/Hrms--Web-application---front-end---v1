import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { MeetingAttendeeResponse } from '../../models/calendar-event.model';

@Component({
  selector: 'app-calendar-event-attendance',
  standalone: true,
  imports: [],
  template: `
    @if (available()) {
      @if (attendees().length === 0) {
        <p data-testid="calendar-attendance-empty" class="text-xs text-[var(--color-text-secondary)]">Nobody joined this meeting.</p>
      } @else {
        <div class="flex flex-col gap-1">
          @for (attendee of attendees(); track attendee.email ?? attendee.name ?? attendee.joinedAt) {
            <div data-testid="calendar-attendance-row" class="flex items-center justify-between text-xs">
              <span class="truncate">{{ attendee.name ?? attendee.email ?? 'Unknown participant' }}</span>
              <span class="shrink-0 text-[var(--color-text-secondary)]">{{ formatDuration(attendee.durationSeconds) }}</span>
            </div>
          }
        </div>
      }
    } @else {
      <p data-testid="calendar-attendance-unavailable" class="text-xs text-[var(--color-text-secondary)]">
        {{ unavailableMessage() }}
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
  protected readonly syncStatus = signal<string>('pending');

  protected unavailableMessage(): string {
    switch (this.syncStatus()) {
      case 'attendance_unavailable':
        return "The meeting provider didn't send attendance data for this meeting.";
      case 'sync_failed':
        return "We couldn't fetch attendance from the meeting provider.";
      case 'none':
        return 'Attendance data unavailable';
      default:
        return 'Attendance appears after the meeting ends.';
    }
  }

  ngOnInit(): void {
    this.api.getMeetingAttendance(this.eventId()).subscribe((response) => {
      this.available.set(response.available);
      this.attendees.set(response.attendees);
      this.syncStatus.set(response.syncStatus ?? 'pending');
    });
  }

  protected formatDuration(seconds: number | null): string {
    if (seconds === null) return '';
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }
}
