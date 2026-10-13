import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/state/auth.store';
import { PermissionService } from '../auth/state/permission.service';
import { TrayPresenceStore } from '../tray-presence/state/tray-presence.store';
import { tenantWorkspaceReady } from '../tray-presence/utils/tenant-workspace-ready';
import { InboxChangedEvent, MessageCreatedEvent, ParticipantAddedEvent } from './inbox-realtime.models';

const CSRF_COOKIE_NAMES = ['onevo_csrf', 'onevo_legal_csrf'];

/**
 * Live inbox + conversation events over SignalR (/hubs/inbox). Authenticates with the tenant session
 * cookie like every other API call; the negotiate POST carries the CSRF header the API requires.
 * Connects only while the tenant workspace is ready (same gate as the notification bell).
 */
@Injectable({ providedIn: 'root' })
export class InboxRealtimeService {
  private readonly authStore = inject(AuthStore);
  private readonly permissionService = inject(PermissionService);
  private readonly trayPresence = inject(TrayPresenceStore);
  private readonly document = inject(DOCUMENT);

  private connection: HubConnection | null = null;
  /** Conversations the UI has open; (re)joined on every connect. */
  private readonly joined = new Set<string>();

  private readonly messageCreated = new Subject<MessageCreatedEvent>();
  private readonly participantAdded = new Subject<ParticipantAddedEvent>();
  private readonly inboxChanged = new Subject<InboxChangedEvent>();

  readonly messageCreated$: Observable<MessageCreatedEvent> = this.messageCreated.asObservable();
  readonly participantAdded$: Observable<ParticipantAddedEvent> = this.participantAdded.asObservable();
  readonly inboxChanged$: Observable<InboxChangedEvent> = this.inboxChanged.asObservable();
  readonly connected = signal(false);

  constructor() {
    effect(() => {
      const ready = tenantWorkspaceReady(this.authStore, this.permissionService, this.trayPresence);
      untracked(() => {
        if (ready) void this.start();
        else this.stop();
      });
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async joinConversation(conversationId: string): Promise<void> {
    this.joined.add(conversationId);
    if (this.connected()) await this.invoke('JoinConversation', conversationId);
  }

  async leaveConversation(conversationId: string): Promise<void> {
    this.joined.delete(conversationId);
    if (this.connected()) await this.invoke('LeaveConversation', conversationId);
  }

  private async start(): Promise<void> {
    if (this.connection) return;
    const connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl(), { withCredentials: true, headers: this.csrfHeaders() })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on('messageCreated', (event: MessageCreatedEvent) => this.messageCreated.next(event));
    connection.on('participantAdded', (event: ParticipantAddedEvent) => this.participantAdded.next(event));
    connection.on('inboxChanged', (event: InboxChangedEvent) => this.inboxChanged.next(event));
    connection.onreconnected(() => void this.rejoinAll());
    this.connection = connection;

    try {
      await connection.start();
    } catch {
      // Realtime is an enhancement: the inbox still works over HTTP, so a failed connect is not fatal.
      if (this.connection === connection) this.connection = null;
      return;
    }
    if (this.connection !== connection) return;
    this.connected.set(true);
    await this.rejoinAll();
  }

  private stop(): void {
    const connection = this.connection;
    this.connection = null;
    this.connected.set(false);
    if (connection) void connection.stop().catch(() => undefined);
  }

  private async rejoinAll(): Promise<void> {
    for (const id of this.joined) await this.invoke('JoinConversation', id);
  }

  private async invoke(method: string, conversationId: string): Promise<void> {
    try {
      await this.connection?.invoke(method, conversationId);
    } catch {
      // A denied or dropped join only loses live updates; the panel still loads over HTTP.
    }
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
