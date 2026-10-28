import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeetingApiService } from '../../../../work/meetings/data-access/meeting-api.service';
import { EmployeeMeetingAttendanceItem } from '../../../../work/meetings/models/meeting.models';
import { attendanceOutcomeLabel, formatAttended } from '../../../../work/meetings/utils/meeting-attendance';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The employee profile's "Meeting attendance" tab (spec D16, D17): the employee's own meetings for the employee, or for a
 * manager in their current reporting line. Anyone else gets 404, and the tab reports itself unavailable so the profile
 * hides it. A private meeting is already masked by the API ("Private meeting", no organizer).
 */
@Component({
  selector: 'app-meeting-attendance-tab',
  standalone: true,
  template: `
    @if (available()) {
      <section class="flex flex-col gap-3 text-sm">
        <div class="flex items-center gap-2 text-xs">
          <span class="text-[var(--color-text-secondary)]">Last</span>
          @for (days of windows; track days) {
            <button type="button" class="rounded-md border px-2 py-0.5" [class.font-semibold]="windowDays() === days" (click)="setWindow(days)">{{ days }} days</button>
          }
        </div>
        @if (items().length === 0) {
          <p class="text-xs text-[var(--color-text-secondary)]">No meetings in this period.</p>
        }
        @for (item of items(); track item.occurrenceTaskId) {
          <div data-testid="employee-meeting-row" class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-xs">
            <span class="text-[var(--color-text-secondary)]">{{ date(item.startAt) }}</span>
            <span class="truncate">{{ item.title }}@if (item.organizerName) {<span data-testid="employee-meeting-organizer" class="text-[var(--color-text-secondary)]"> · {{ item.organizerName }}</span>}</span>
            <span>{{ outcome(item) }}</span>
            <span class="text-[var(--color-text-secondary)]">{{ time(item.attendedSeconds) }}</span>
          </div>
        }
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingAttendanceTabComponent implements OnInit {
  private readonly api = inject(MeetingApiService);

  readonly employeeId = input.required<string>();
  /** True once the API answered for this caller, false on 404 (not the employee or their reporting line). */
  readonly availability = output<boolean>();

  readonly windows = [30, 60, 92];
  readonly windowDays = signal(30);
  readonly items = signal<readonly EmployeeMeetingAttendanceItem[]>([]);
  readonly available = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  async setWindow(days: number): Promise<void> {
    this.windowDays.set(Math.min(days, 92));
    await this.load();
  }

  protected outcome(item: EmployeeMeetingAttendanceItem): string {
    return attendanceOutcomeLabel(item.outcome, item.status);
  }

  protected time(seconds: number | null): string {
    return formatAttended(seconds);
  }

  protected date(utc: string): string {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(utc));
  }

  private async load(): Promise<void> {
    const to = new Date();
    const from = new Date(to.getTime() - this.windowDays() * DAY_MS);
    try {
      const response = await firstValueFrom(this.api.employeeMeetingAttendance(this.employeeId(), from.toISOString(), to.toISOString()));
      this.items.set(response.items);
      if (!this.available()) {
        this.available.set(true);
        this.availability.emit(true);
      }
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        this.available.set(false);
        this.availability.emit(false);
      }
      this.items.set([]);
    }
  }
}
