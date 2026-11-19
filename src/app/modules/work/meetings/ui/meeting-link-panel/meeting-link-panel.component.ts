import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
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
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #teamsIcon>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="18.5" cy="7" r="2.5" fill="#7B83EB" /><path d="M15.5 10.5h6a1 1 0 0 1 1 1v4a3.5 3.5 0 0 1-7 0v-5Z" fill="#7B83EB" /><rect x="1.5" y="6" width="13" height="13" rx="2.5" fill="#5059C9" /><path d="M5 9.5h6M8 9.5v6.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" /></svg>
    </ng-template>
    <ng-template #zoomIcon>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#2D8CFF" /><path d="M6.5 9.5h6.5a1.5 1.5 0 0 1 1.5 1.5v4H8a1.5 1.5 0 0 1-1.5-1.5v-4Zm8.5 2 3-2v5.5l-3-2" fill="#fff" /></svg>
    </ng-template>

    <div class="flex flex-col gap-3 text-sm">
      <!-- The link once it is there: it stays in the card, before and after the meeting -->
      @if (joinUrl(); as url) {
        <div data-testid="meeting-link-box" class="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3">
          <div class="flex min-w-0 items-center gap-2">
            @switch (providerOf(url)) {
              @case ('zoom') { <ng-container *ngTemplateOutlet="zoomIcon" /> }
              @case ('microsoft_teams') { <ng-container *ngTemplateOutlet="teamsIcon" /> }
              @default {
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
              }
            }
            <a data-testid="meeting-link-url" [href]="url" target="_blank" rel="noopener" [title]="url"
              class="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-accent)] hover:underline">{{ url }}</a>
          </div>
          <div class="flex flex-wrap gap-2">
            <a data-testid="meeting-link-join" [href]="url" target="_blank" rel="noopener"
              class="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-text-on-solid)] shadow-2xs transition-colors hover:bg-[var(--color-accent-hover)]">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /></svg>
              Join
            </a>
            <button type="button" data-testid="meeting-link-copy" [class]="button" (click)="copy(url)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></svg>
              {{ copied() ? 'Copied' : 'Copy link' }}
            </button>
          </div>
        </div>
      }
      @if (isOrganizer()) {
        <div class="flex flex-col gap-3" data-testid="meeting-link-organizer">
          @if (link(); as l) {
            <p class="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <ng-container *ngTemplateOutlet="l.provider === 'zoom' ? zoomIcon : teamsIcon" />
              {{ providerName(l.provider) }} · {{ statusLabel(l.status) }}
            </p>
            @if (l.status === 'unresolved') {
              <p class="text-xs">Delete it in Teams/Zoom, then confirm</p>
              <button type="button" data-testid="meeting-link-cleanup" [class]="button + ' self-start'" [disabled]="busy()"
                (click)="confirmCleanup()">I deleted it</button>
            }
            @if (!ended() && (l.status === 'provisioning_unknown' || l.status === 'failed')) {
              <button type="button" data-testid="meeting-link-retry" [class]="button + ' self-start'" [disabled]="busy()"
                (click)="retry()">Retry</button>
            }
            @if (!ended() && (l.status === 'active' || l.status === 'failed')) {
              <div class="flex flex-wrap gap-2">
                <button type="button" data-testid="meeting-link-regenerate" [class]="button" [disabled]="busy()"
                  (click)="create(l.provider, true)">Regenerate</button>
                <button type="button" data-testid="meeting-link-remove" [class]="button" [disabled]="busy()"
                  (click)="remove()">Remove</button>
              </div>
            }
            @if (l.releasePending) {
              <p class="text-xs text-[var(--color-text-secondary)]">Kept for other meetings in this series</p>
            }
          }
          @if (canAdd() && !ended()) {
            <div data-testid="meeting-link-add" class="flex flex-wrap gap-3">
              <button type="button" [class]="button" [disabled]="busy()" (click)="create('microsoft_teams', false)">
                <ng-container *ngTemplateOutlet="teamsIcon" />
                Add Teams link
              </button>
              <button type="button" [class]="button" [disabled]="busy()" (click)="create('zoom', false)">
                <ng-container *ngTemplateOutlet="zoomIcon" />
                Add Zoom link
              </button>
            </div>
          }
          @if (ended() && !joinUrl()) {
            <p data-testid="meeting-link-none" class="text-xs text-[var(--color-text-secondary)]">No online meeting link was added.</p>
          }
          @if (error()) {
            <p class="text-xs text-[var(--color-danger)]">{{ error() }}</p>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingLinkPanelComponent implements OnInit {
  private readonly api = inject(MeetingApiService);

  readonly seriesId = input.required<string>();
  readonly isOrganizer = input(false);
  /** After the meeting the link stays on show, but no new link is added or changed. */
  readonly ended = input(false);
  readonly copied = signal(false);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly button =
    'inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] shadow-2xs transition-colors hover:bg-[var(--color-surface-secondary)] disabled:opacity-60';

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
    inject(DestroyRef).onDestroy(() => {
      this.stopPolling();
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
    });
  }

  ngOnInit(): void {
    void this.refresh();
  }

  /** Teams or Zoom from the link's own state, else from its address; null for any other link. */
  protected providerOf(url: string): MeetingPlatform | null {
    const provider = this.link()?.provider;
    if (provider) return provider;
    if (/teams\.(microsoft|live)\.com/i.test(url)) return 'microsoft_teams';
    if (/zoom\.us/i.test(url)) return 'zoom';
    return null;
  }

  async copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    this.copied.set(true);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(false), 2000);
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
