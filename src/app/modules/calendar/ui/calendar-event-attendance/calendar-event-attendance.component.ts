import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { MeetingAttendeeResponse, MeetingIncidentResponse } from '../../models/calendar-event.model';

/** The organizer's read-only Attendance view of an ended event: who joined and left the online meeting (the provider's
 *  report) and the incidents the meeting raised for its participants. */
@Component({
  selector: 'app-calendar-event-attendance',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (available()) {
      @if (attendees().length === 0) {
        <p data-testid="calendar-attendance-empty" class="text-xs text-[var(--color-text-secondary)]">Nobody joined this meeting.</p>
      } @else {
        <div class="flex flex-col gap-1">
          @for (attendee of attendees(); track attendee.email ?? attendee.name ?? attendee.joinedAt) {
            <div data-testid="calendar-attendance-row" class="flex items-center justify-between gap-2 text-xs">
              <span class="truncate">{{ attendee.name ?? attendee.email ?? 'Unknown participant' }}</span>
              <span class="shrink-0 text-[var(--color-text-secondary)]">
                {{ time(attendee.joinedAt) }} – {{ attendee.leftAt ? time(attendee.leftAt) : 'still in' }} · {{ formatDuration(attendee.durationSeconds) }}
              </span>
            </div>
          }
        </div>
      }
    } @else {
      <p data-testid="calendar-attendance-unavailable" class="text-xs text-[var(--color-text-secondary)]">
        {{ unavailableMessage() }}
      </p>
    }
    @if (incidents().length > 0) {
      <div class="mt-2 flex flex-col gap-1" data-testid="calendar-incidents">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Incidents raised</div>
        @for (incident of incidents(); track $index) {
          <div data-testid="calendar-incident-row" class="flex items-center justify-between gap-2 text-xs">
            <span class="truncate">{{ incident.employeeName }} · {{ incident.rule }}</span>
            <span class="flex shrink-0 items-center gap-1 text-[var(--color-text-secondary)]">
              {{ incident.occurrenceStart | date: 'MMM d, h:mm a' }}
              @if (incident.estimated) {
                <span data-testid="calendar-incident-estimated" class="rounded-full bg-[var(--color-surface-secondary)] px-1.5 text-[10px] font-semibold"
                  title="Detected from the desktop agent, not the meeting report">estimated</span>
              }
            </span>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventAttendanceComponent implements OnInit {
  private readonly api = inject(CalendarEventApiService);

  eventId = input.required<string>();
  protected readonly available = signal(false);
  protected readonly attendees = signal<readonly MeetingAttendeeResponse[]>([]);
  protected readonly incidents = signal<readonly MeetingIncidentResponse[]>([]);
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
      this.incidents.set(response.incidents ?? []);
    });
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  protected formatDuration(seconds: number | null): string {
    if (seconds == null) return '';
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }
}
