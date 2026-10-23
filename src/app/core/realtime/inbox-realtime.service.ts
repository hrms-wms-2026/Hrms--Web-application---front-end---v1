import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { HubConnection, HubConnectionBuilder, IHttpConnectionOptions, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/state/auth.store';
import { PermissionService } from '../auth/state/permission.service';
import { TrayPresenceStore } from '../tray-presence/state/tray-presence.store';
import { tenantWorkspaceReady } from '../tray-presence/utils/tenant-workspace-ready';
import {
  InboxChangedEvent,
  MessageCreatedEvent,
  MessageDeletedEvent,
  MessageUpdatedEvent,
  MessageHiddenEvent,
  ParticipantAddedEvent,
  ParticipantReadEvent,
  ParticipantRemovedEvent
} from './inbox-realtime.models';

const CSRF_COOKIE_NAMES = ['onevo_csrf', 'onevo_legal_csrf'];
/** Waits before each new connection attempt once the built-in auto-reconnect has given up (or a start failed). */
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

export type InboxHubConnectionFactory = (url: string, options: IHttpConnectionOptions) => HubConnection;

/** Builds the hub connection (auto-reconnect, warnings only). A token so tests can supply a fake connection. */
export const INBOX_HUB_CONNECTION_FACTORY = new InjectionToken<InboxHubConnectionFactory>('INBOX_HUB_CONNECTION_FACTORY', {
  providedIn: 'root',
  factory: () => (url, options) => new HubConnectionBuilder()
    .withUrl(url, options)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
});

/**
 * Live inbox + conversation events over SignalR (/hubs/inbox). Authenticates with the tenant session
 * cookie like every other API call; the negotiate POST carries the CSRF header the API requires.
 * Connects only while the tenant workspace is ready (same gate as the notification bell). The hub puts
 * each connection in the user's own group and addresses every event to its recipients, so there is
 * nothing to join. When the connection is lost for good, a fresh one (with a fresh CSRF header) is built
 * with backoff while the workspace stays ready; after any reconnect, `reconnected$` lets stores refetch
 * what they may have missed.
 */
@Injectable({ providedIn: 'root' })
export class InboxRealtimeService {
  private readonly authStore = inject(AuthStore);
  private readonly permissionService = inject(PermissionService);
  private readonly trayPresence = inject(TrayPresenceStore);
  private readonly document = inject(DOCUMENT);
  private readonly createConnection = inject(INBOX_HUB_CONNECTION_FACTORY);

  private connection: HubConnection | null = null;
  private wanted = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;

  private readonly messageCreated = new Subject<MessageCreatedEvent>();
  private readonly participantAdded = new Subject<ParticipantAddedEvent>();
  private readonly inboxChanged = new Subject<InboxChangedEvent>();
  private readonly messageUpdated = new Subject<MessageUpdatedEvent>();
  private readonly messageDeleted = new Subject<MessageDeletedEvent>();
  private readonly messageHidden = new Subject<MessageHiddenEvent>();
  private readonly participantRead = new Subject<ParticipantReadEvent>();
  private readonly participantRemoved = new Subject<ParticipantRemovedEvent>();
  private readonly reconnected = new Subject<void>();

  readonly messageCreated$: Observable<MessageCreatedEvent> = this.messageCreated.asObservable();
  readonly participantAdded$: Observable<ParticipantAddedEvent> = this.participantAdded.asObservable();
  readonly inboxChanged$: Observable<InboxChangedEvent> = this.inboxChanged.asObservable();
  readonly messageUpdated$: Observable<MessageUpdatedEvent> = this.messageUpdated.asObservable();
  readonly messageDeleted$: Observable<MessageDeletedEvent> = this.messageDeleted.asObservable();
  readonly messageHidden$: Observable<MessageHiddenEvent> = this.messageHidden.asObservable();
  readonly participantRead$: Observable<ParticipantReadEvent> = this.participantRead.asObservable();
  readonly participantRemoved$: Observable<ParticipantRemovedEvent> = this.participantRemoved.asObservable();
  readonly reconnected$: Observable<void> = this.reconnected.asObservable();
  readonly connected = signal(false);

  constructor() {
    effect(() => {
      const ready = tenantWorkspaceReady(this.authStore, this.permissionService, this.trayPresence);
      untracked(() => {
        if (ready) {
          this.wanted = true;
          void this.start();
        } else {
          this.stop();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private async start(): Promise<void> {
    if (this.connection || !this.wanted) return;
    const recovering = this.attempt > 0;
    const connection = this.createConnection(this.hubUrl(), { withCredentials: true, headers: this.csrfHeaders() });
    connection.on('messageCreated', (event: MessageCreatedEvent) => this.messageCreated.next(event));
    connection.on('participantAdded', (event: ParticipantAddedEvent) => this.participantAdded.next(event));
    connection.on('inboxChanged', (event: InboxChangedEvent) => this.inboxChanged.next(event));
    connection.on('messageUpdated', (event: MessageUpdatedEvent) => this.messageUpdated.next(event));
    connection.on('messageDeleted', (event: MessageDeletedEvent) => this.messageDeleted.next(event));
    connection.on('messageHidden', (event: MessageHiddenEvent) => this.messageHidden.next(event));
    connection.on('participantRead', (event: ParticipantReadEvent) => this.participantRead.next(event));
    connection.on('participantRemoved', (event: ParticipantRemovedEvent) => this.participantRemoved.next(event));
    connection.onreconnected(() => this.reconnected.next());
    connection.onclose(() => this.lost(connection));
    this.connection = connection;

    try {
      await connection.start();
    } catch {
      // Realtime is an enhancement: the inbox still works over HTTP, so a failed connect only schedules a retry.
      this.lost(connection);
      return;
    }
    if (this.connection !== connection) return;
    this.attempt = 0;
    this.connected.set(true);
    if (recovering) this.reconnected.next();
  }

  /** The connection closed (auto-reconnect gave up) or never started: try again later with a new one. */
  private lost(connection: HubConnection): void {
    if (this.connection !== connection) return;
    this.connection = null;
    this.connected.set(false);
    if (!this.wanted || this.retryTimer) return;
    const delay = RETRY_DELAYS_MS[Math.min(this.attempt, RETRY_DELAYS_MS.length - 1)];
    this.attempt++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.start();
    }, delay);
  }

  private stop(): void {
    this.wanted = false;
    this.attempt = 0;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const connection = this.connection;
    this.connection = null;
    this.connected.set(false);
    if (connection) void connection.stop().catch(() => undefined);
  }

  /** The hub is mapped at the API host root, not under /api/v1. */
  private hubUrl(): string {
    return `${environment.apiUrl.replace(/\/api\/v1\/?$/, '')}/hubs/inbox`;
  }

  private csrfHeaders(): Record<string, string> {
    const cookies = (this.document.cookie ?? '').split(';').map((c) => c.trim());
    for (const name of CSRF_COOKIE_NAMES) {
      const match = cookies.find((c) => c.startsWith(`${name}=`));
      if (match) return { 'X-CSRF-Token': decodeURIComponent(match.slice(name.length + 1)) };
    }
    return {};
  }
}
