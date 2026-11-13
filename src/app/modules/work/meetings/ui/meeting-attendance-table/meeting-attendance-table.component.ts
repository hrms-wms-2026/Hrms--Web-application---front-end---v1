import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingAttendanceResponse, MeetingAttendee } from '../../models/meeting.models';
import { attendanceOutcomeLabel, formatAttended } from '../../utils/meeting-attendance';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';

const RECHECK_FOR_MS = 7 * 24 * 60 * 60 * 1000;

interface AttendanceLine { key: string; name: string; time: string; outcome: string; }

/**
 * One occurrence's attendance (spec 5.8, D16): the organizer sees every attendee - including those with no attendance
 * row - and the sessions not matched to the meeting; an attendee sees their own row. Recheck is the organizer's, for
 * 7 days after the end.
 */
@Component({
  selector: 'app-meeting-attendance-table',
  standalone: true,
  template: `
    <div class="flex flex-col gap-3 text-xs">
      <div class="flex items-center justify-between gap-2">
        <h3 class="flex items-center gap-2.5 text-base font-semibold text-[var(--color-text-primary)]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M9 14.5l2 2 4-4" /></svg>
          Attendance
        </h3>
        @if (attendance(); as a) {
          <span data-testid="attendance-display" class="rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{{ a.display }}</span>
        }
      </div>
    @if (attendance(); as a) {
      <div class="flex flex-col gap-1 text-xs">
        @for (line of lines(); track line.key) {
          <div data-testid="attendance-row" class="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1">
            <span class="truncate">{{ line.name }}</span>
            <span data-testid="attendance-time" class="text-[var(--color-text-secondary)]">{{ line.time }}</span>
            <span data-testid="attendance-outcome">{{ line.outcome }}</span>
          </div>
        }
        @if (isOrganizer() && a.unmatched && a.unmatched.length > 0) {
          <div data-testid="attendance-unmatched" class="mt-1 text-[var(--color-text-secondary)]">
            Sessions not matched to a meeting: {{ a.unmatched.length }}
          </div>
        }
        @if (canRecheck()) {
          <button type="button" data-testid="attendance-recheck" class="mt-1 self-start rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-secondary)] disabled:opacity-60" [disabled]="rechecking()"
            (click)="recheck()">Recheck attendance</button>
        }
        @if (message()) {
          <p class="text-[var(--color-text-secondary)]">{{ message() }}</p>
        }
      </div>
    }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingAttendanceTableComponent implements OnInit {
  private readonly api = inject(MeetingApiService);

  readonly seriesId = input.required<string>();
  readonly originalStart = input.required<string>();
  readonly endAt = input.required<string>();
  readonly isOrganizer = input(false);
  /** The occurrence's attendees, so the organizer also sees the people with no attendance row. */
  readonly attendees = input<readonly MeetingAttendee[]>([]);

  readonly attendance = signal<MeetingAttendanceResponse | null>(null);
  readonly rechecking = signal(false);
  readonly message = signal<string | null>(null);
  private readonly expired = signal(false);

  readonly canRecheck = computed(() =>
    this.isOrganizer() && !this.expired() && this.attendance()?.status !== 'not_applicable'
    && Date.now() - Date.parse(this.endAt()) <= RECHECK_FOR_MS);

  readonly lines = computed<AttendanceLine[]>(() => {
    const a = this.attendance();
    if (!a) return [];
    const lines: AttendanceLine[] = a.rows.map((r) => ({
      key: r.employeeId ?? r.email ?? r.displayName, name: r.displayName, time: formatAttended(r.attendedSeconds),
      outcome: attendanceOutcomeLabel(r.outcome, a.status),
    }));
    if (this.isOrganizer()) {
      const seen = new Set(a.rows.map((r) => r.employeeId ?? r.email?.toLowerCase()));
      for (const person of this.attendees()) {
        const key = person.employeeId ?? person.email?.toLowerCase();
        if (!key || seen.has(key)) continue;
        lines.push({ key, name: person.name ?? person.email ?? '', time: formatAttended(null), outcome: attendanceOutcomeLabel(null, a.status) });
      }
    }
    return lines;
  });

  ngOnInit(): void {
    void this.load();
  }

  async recheck(): Promise<void> {
    this.rechecking.set(true);
    this.message.set(null);
    try {
      const status = await firstValueFrom(this.api.recheckAttendance(this.seriesId(), this.originalStart()));
      this.message.set(status.nextCheckAt ? 'Checking again with the meeting provider.' : 'Attendance rechecked.');
      await this.load();
    } catch (e) {
      const code = e instanceof HttpErrorResponse ? (e.error?.code as string | undefined) : undefined;
      if (code === 'attendance_recheck_expired') this.expired.set(true);
      this.message.set(meetingErrorMessage(code));
    } finally {
      this.rechecking.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      this.attendance.set(await firstValueFrom(this.api.getAttendance(this.seriesId(), this.originalStart())));
    } catch {
      this.attendance.set(null);
    }
  }
}
