import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingLinkResponse, MeetingLinkStatus, MeetingPlatform } from '../../models/meeting.models';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';

const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 2 * 60 * 1000;

const STATUS_LABELS: Record<MeetingLinkStatus, string> = {
  provisioning: 'Creating the link…',
  active: 'Active',
  provisioning_unknown: "Couldn't confirm the link with the provider",
  failed: "The link couldn't be created",
  unresolved: 'Needs cleanup',
  cancelled: 'Removed',
  not_connected: 'Your Teams/Zoom account is not connected',
};
const PROVIDERS: Record<MeetingPlatform, string> = { microsoft_teams: 'Teams', zoom: 'Zoom' };

/**
 * The series' Teams/Zoom link (spec 5.7). An attendee sees Join, or nothing. The organizer sees the link's state and
 * what can be done next; while it is being created the panel polls every 3 s for up to 2 minutes (Review Focus 2).
 */
@Component({
  selector: 'app-meeting-link-panel',
  standalone: true,
  template: `
    @if (joinUrl(); as url) {
      <a data-testid="meeting-link-join" [href]="url" target="_blank" rel="noopener"
        class="inline-flex rounded-md bg-[var(--color-accent)] px-3 py-1 text-sm text-[var(--color-accent-contrast)]">Join</a>
    }
    @if (isOrganizer()) {
      <div class="mt-2 flex flex-col gap-2 text-sm" data-testid="meeting-link-organizer">
        @if (link(); as l) {
          <p class="text-xs text-[var(--color-text-secondary)]">{{ providerName(l.provider) }} · {{ statusLabel(l.status) }}</p>
          @if (l.status === 'unresolved') {
            <p class="text-xs">Delete it in Teams/Zoom, then confirm</p>
            <button type="button" data-testid="meeting-link-cleanup" class="self-start rounded-md border px-3 py-1 text-xs" [disabled]="busy()"
              (click)="confirmCleanup()">I deleted it</button>
          }
          @if (l.status === 'provisioning_unknown' || l.status === 'failed') {
            <button type="button" data-testid="meeting-link-retry" class="self-start rounded-md border px-3 py-1 text-xs" [disabled]="busy()"
              (click)="retry()">Retry</button>
          }
          @if (l.status === 'active' || l.status === 'failed') {
            <div class="flex gap-2">
              <button type="button" data-testid="meeting-link-regenerate" class="rounded-md border px-3 py-1 text-xs" [disabled]="busy()"
                (click)="create(l.provider, true)">Regenerate</button>
              <button type="button" data-testid="meeting-link-remove" class="rounded-md border px-3 py-1 text-xs" [disabled]="busy()"
                (click)="remove()">Remove</button>
            </div>
          }
          @if (l.releasePending) {
            <p class="text-xs text-[var(--color-text-secondary)]">Kept for other meetings in this series</p>
          }
        }
        @if (canAdd()) {
          <div data-testid="meeting-link-add" class="flex gap-2">
            <button type="button" class="rounded-md border px-3 py-1 text-xs" [disabled]="busy()" (click)="create('microsoft_teams', false)">Add Teams link</button>
            <button type="button" class="rounded-md border px-3 py-1 text-xs" [disabled]="busy()" (click)="create('zoom', false)">Add Zoom link</button>
          </div>
        }
        @if (error()) {
          <p class="text-xs text-[var(--color-danger)]">{{ error() }}</p>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingLinkPanelComponent implements OnInit {
  private readonly api = inject(MeetingApiService);

  readonly seriesId = input.required<string>();
  readonly isOrganizer = input(false);

  readonly joinUrl = signal<string | null>(null);
  readonly link = signal<MeetingLinkResponse | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly canAdd = computed(() => {
    const l = this.link();
    return !l || l.status === 'cancelled' || l.status === 'not_connected';
  });

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollStartedAt: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  ngOnInit(): void {
    void this.refresh();
  }

  protected statusLabel(status: MeetingLinkStatus): string {
    return STATUS_LABELS[status];
  }

  protected providerName(provider: MeetingPlatform): string {
    return PROVIDERS[provider];
  }

  async create(platform: MeetingPlatform, regenerate: boolean): Promise<void> {
    await this.run(async () => this.show(await firstValueFrom(this.api.createLink(this.seriesId(), { platform, regenerate }))));
  }

  async retry(): Promise<void> {
    await this.run(async () => this.show(await firstValueFrom(this.api.retryLink(this.seriesId()))));
  }

  async remove(): Promise<void> {
    await this.run(async () => this.show(await firstValueFrom(this.api.removeLink(this.seriesId()))));
  }

  async confirmCleanup(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.confirmLinkCleanup(this.seriesId()));
      await this.refresh();
    });
  }

  private async refresh(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getLink(this.seriesId()));
      this.joinUrl.set(response.joinUrl);
      this.show(response.link ?? null, false);
    } catch (e) {
      this.stopPolling();
      this.error.set(meetingErrorMessage(e instanceof HttpErrorResponse ? e.error?.code : undefined));
    }
  }

  /** Shows a link state; a provisioning one keeps the poll going until a terminal state or the 2-minute limit. */
  private show(link: MeetingLinkResponse | null, fromAction = true): void {
    this.link.set(link);
    if (fromAction && link) this.joinUrl.set(link.joinUrl);
    if (link?.status === 'provisioning') {
      if (this.pollStartedAt === null) this.pollStartedAt = Date.now();
      if (Date.now() - this.pollStartedAt < POLL_FOR_MS) {
        this.pollTimer = setTimeout(() => void this.refresh(), POLL_EVERY_MS);
        return;
      }
    }
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.pollStartedAt = null;
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(meetingErrorMessage(e instanceof HttpErrorResponse ? e.error?.code : undefined));
    } finally {
      this.busy.set(false);
    }
  }
}
