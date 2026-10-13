import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthStore } from '../auth/state/auth.store';
import { PermissionService } from '../auth/state/permission.service';
import { TrayPresenceStore } from '../tray-presence/state/tray-presence.store';

type Handler = (...args: unknown[]) => void;

const hub = vi.hoisted(() => {
  type Fn = ReturnType<typeof vi.fn>;
  const state = {
    handlers: new Map<string, Handler>(),
    reconnected: null as (() => void) | null,
    options: null as Record<string, unknown> | null,
    url: '',
    connection: null as { on: Fn; onreconnected: Fn; start: Fn; stop: Fn; invoke: Fn } | null
  };
  function makeConnection() {
    const connection = {
      on: vi.fn((name: string, handler: Handler) => state.handlers.set(name, handler)),
      onreconnected: vi.fn((cb: () => void) => { state.reconnected = cb; }),
      start: vi.fn(() => Promise.resolve()),
      stop: vi.fn(() => Promise.resolve()),
      invoke: vi.fn(() => Promise.resolve())
    };
    state.connection = connection;
    return connection;
  }
  class HubConnectionBuilder {
    withUrl(url: string, options: Record<string, unknown>) { state.url = url; state.options = options; return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() { return makeConnection(); }
  }
  return { state, HubConnectionBuilder };
});

vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: hub.HubConnectionBuilder,
  LogLevel: { Warning: 3 }
}));

import { InboxRealtimeService } from './inbox-realtime.service';

describe('InboxRealtimeService', () => {
  const authenticated = signal(false);
  let service: InboxRealtimeService;
  let fakeDocument: { cookie: string };

  function setup(): void {
    fakeDocument = { cookie: 'other=1; onevo_csrf=tok%2B1' };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { authenticated } },
        { provide: PermissionService, useValue: { hasModule: () => false } },
        { provide: TrayPresenceStore, useValue: { canRenderProtectedContent: () => true } },
        { provide: DOCUMENT, useValue: fakeDocument }
      ]
    });
    service = TestBed.inject(InboxRealtimeService);
  }

  beforeEach(() => {
    hub.state.handlers.clear();
    hub.state.connection = null;
    hub.state.options = null;
    authenticated.set(false);
    setup();
  });

  async function connect(): Promise<void> {
    authenticated.set(true);
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('does not connect until the tenant workspace is ready', () => {
    TestBed.tick();
    expect(hub.state.connection).toBeNull();
  });

  it('connects to /hubs/inbox with cookies and the CSRF header once the workspace is ready', async () => {
    await connect();

    expect(hub.state.url).toMatch(/\/hubs\/inbox$/);
    expect(hub.state.url).not.toContain('/api/v1');
    expect(hub.state.options).toMatchObject({ withCredentials: true, headers: { 'X-CSRF-Token': 'tok+1' } });
    expect(hub.state.connection!.start).toHaveBeenCalled();
    expect(service.connected()).toBe(true);
  });

  it('re-emits hub events on the matching streams', async () => {
    await connect();
    const created = vi.fn();
    const added = vi.fn();
    const changed = vi.fn();
    service.messageCreated$.subscribe(created);
    service.participantAdded$.subscribe(added);
    service.inboxChanged$.subscribe(changed);

    hub.state.handlers.get('messageCreated')!({ conversationId: 'c1', message: { id: 'm1' } });
    hub.state.handlers.get('participantAdded')!({ conversationId: 'c1', participant: { employeeId: 'e1' } });
    hub.state.handlers.get('inboxChanged')!({ item: { source: 'work', kind: 'approval', id: 'a1' } });

    expect(created).toHaveBeenCalledWith({ conversationId: 'c1', message: { id: 'm1' } });
    expect(added).toHaveBeenCalledWith({ conversationId: 'c1', participant: { employeeId: 'e1' } });
    expect(changed).toHaveBeenCalledWith({ item: { source: 'work', kind: 'approval', id: 'a1' } });
  });

  it('joins and leaves conversation groups through the hub', async () => {
    await connect();

    await service.joinConversation('c1');
    await service.leaveConversation('c1');

    expect(hub.state.connection!.invoke).toHaveBeenCalledWith('JoinConversation', 'c1');
    expect(hub.state.connection!.invoke).toHaveBeenCalledWith('LeaveConversation', 'c1');
  });

  it('remembers a join requested before the connection is up and sends it on connect', async () => {
    await service.joinConversation('c9');
    expect(hub.state.connection).toBeNull();

    await connect();

    expect(hub.state.connection!.invoke).toHaveBeenCalledWith('JoinConversation', 'c9');
  });

  it('re-joins open conversations after an automatic reconnect', async () => {
    await connect();
    await service.joinConversation('c1');
    hub.state.connection!.invoke.mockClear();

    hub.state.reconnected!();
    await Promise.resolve();

    expect(hub.state.connection!.invoke).toHaveBeenCalledWith('JoinConversation', 'c1');
  });

  it('stops the connection when the workspace becomes unavailable (sign-out)', async () => {
    await connect();
    const connection = hub.state.connection!;

    authenticated.set(false);
    TestBed.tick();

    expect(connection.stop).toHaveBeenCalled();
    expect(service.connected()).toBe(false);
  });

  it('a failed start leaves the service disconnected without throwing', async () => {
    const original = hub.HubConnectionBuilder.prototype.build;
    hub.HubConnectionBuilder.prototype.build = function () {
      const c = original.call(this);
      c.start.mockImplementation(() => Promise.reject(new Error('offline')));
      return c;
    };
    try {
      await connect();
      await Promise.resolve();
      expect(service.connected()).toBe(false);
    } finally {
      hub.HubConnectionBuilder.prototype.build = original;
    }
  });
});
