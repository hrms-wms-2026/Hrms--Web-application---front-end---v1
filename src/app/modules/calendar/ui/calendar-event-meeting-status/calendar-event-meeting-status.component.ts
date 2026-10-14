import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { EventMeetingStatusResponse } from '../../models/calendar-event.model';
import { meetingErrorMessage } from '../../utils/meeting-error-message';

/** Organizer-only panel for a meeting link that isn't simply active: unknown (Retry/Remove),
 * unresolved (clean up, then confirm) or failed. Renders nothing otherwise, or for non-organizers. */
@Component({
  selector: 'app-calendar-event-meeting-status',
  standalone: true,
  template: `
    @if (state(); as s) {
      @if (s.status === 'provisioning_unknown' || s.status === 'unresolved' || s.status === 'failed') {
        <div data-testid="calendar-meeting-status" class="rounded-md border border-[var(--color-border)] p-2 text-xs" role="status">
          @switch (s.status) {
            @case ('provisioning_unknown') {
              <p class="font-medium">Meeting link status unknown</p>
              <p class="text-[var(--color-text-secondary)]">We couldn't confirm whether the {{ name() }} meeting was created. Invitations went out without a link.</p>
              <div class="mt-2 flex gap-2">
                <button type="button" data-testid="calendar-meeting-retry" class="text-[var(--color-accent)]" [disabled]="busy()" (click)="retry()">Retry</button>
                <button type="button" data-testid="calendar-meeting-remove" class="text-red-600" [disabled]="busy()" (click)="remove()">Remove</button>
              </div>
            }
            @case ('unresolved') {
              <p class="font-medium">A {{ name() }} meeting may still exist</p>
              <p class="text-[var(--color-text-secondary)]">Please check and delete it in {{ name() }}, then confirm here.</p>
              <button type="button" data-testid="calendar-meeting-confirm-cleanup" class="mt-2 text-[var(--color-accent)]" [disabled]="busy()" (click)="confirmCleanup()">
                I've deleted it
              </button>
            }
            @case ('failed') {
              <p>The {{ name() }} link couldn't be created. You can add a meeting again.</p>
            }
          }
          @if (error()) {
            <p class="mt-1 text-red-600" role="alert">{{ error() }}</p>
          }
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventMeetingStatusComponent implements OnInit {
  private readonly api = inject(CalendarEventApiService);

  eventId = input.required<string>();
  readonly changed = output<void>();

  protected readonly state = signal<EventMeetingStatusResponse | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected name(): string {
    return this.state()?.provider === 'zoom' ? 'Zoom' : 'Microsoft Teams';
  }

  protected retry(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.retryMeeting(this.eventId())));
  }

  protected remove(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.removeMeeting(this.eventId())));
  }

  protected confirmCleanup(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.confirmMeetingCleanup(this.eventId())));
  }

  private async act(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      this.changed.emit();
    } catch (err) {
      this.error.set(meetingErrorMessage(err, this.state()?.provider));
    } finally {
      this.busy.set(false);
      this.load();
    }
  }

  private load(): void {
    this.api.getMeeting(this.eventId()).subscribe({
      next: (state) => this.state.set(state),
      error: () => this.state.set(null) // not the organizer (403) or no access: show nothing
    });
  }
}
