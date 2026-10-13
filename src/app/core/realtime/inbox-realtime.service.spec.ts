import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthStore } from '../auth/state/auth.store';
import { PermissionService } from '../auth/state/permission.service';
import { TrayPresenceStore } from '../tray-presence/state/tray-presence.store';
import { INBOX_HUB_CONNECTION_FACTORY, InboxRealtimeService } from './inbox-realtime.service';

type Handler = (...args: unknown[]) => void;
type Fn = ReturnType<typeof vi.fn>;

const hub = {
  handlers: new Map<string, Handler>(),
  reconnected: null as (() => void) | null,
  options: null as Record<string, unknown> | null,
  url: '',
  connection: null as { on: Fn; onreconnected: Fn; start: Fn; stop: Fn; invoke: Fn } | null,
  failStart: false
};

function fakeFactory(url: string, options: Record<string, unknown>) {
  hub.url = url;
  hub.options = options;
  const connection = {
    on: vi.fn((name: string, handler: Handler) => hub.handlers.set(name, handler)),
    onreconnected: vi.fn((cb: () => void) => { hub.reconnected = cb; }),
    start: vi.fn(() => (hub.failStart ? Promise.reject(new Error('offline')) : Promise.resolve())),
    stop: vi.fn(() => Promise.resolve()),
    invoke: vi.fn(() => Promise.resolve())
  };
  hub.connection = connection;
  return connection;
}

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
        { provide: DOCUMENT, useValue: fakeDocument },
        { provide: INBOX_HUB_CONNECTION_FACTORY, useValue: fakeFactory }
      ]
    });
    service = TestBed.inject(InboxRealtimeService);
  }

  beforeEach(() => {
    hub.handlers.clear();
    hub.connection = null;
    hub.options = null;
    hub.failStart = false;
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
    expect(hub.connection).toBeNull();
  });

  it('connects to /hubs/inbox with cookies and the CSRF header once the workspace is ready', async () => {
    await connect();

    expect(hub.url).toMatch(/\/hubs\/inbox$/);
    expect(hub.url).not.toContain('/api/v1');
    expect(hub.options).toMatchObject({ withCredentials: true, headers: { 'X-CSRF-Token': 'tok+1' } });
    expect(hub.connection!.start).toHaveBeenCalled();
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

    hub.handlers.get('messageCreated')!({ conversationId: 'c1', message: { id: 'm1' } });
    hub.handlers.get('participantAdded')!({ conversationId: 'c1', participant: { employeeId: 'e1' } });
    hub.handlers.get('inboxChanged')!({ item: { source: 'work', kind: 'approval', id: 'a1' } });

    expect(created).toHaveBeenCalledWith({ conversationId: 'c1', message: { id: 'm1' } });
    expect(added).toHaveBeenCalledWith({ conversationId: 'c1', participant: { employeeId: 'e1' } });
    expect(changed).toHaveBeenCalledWith({ item: { source: 'work', kind: 'approval', id: 'a1' } });
  });

  it('emits reconnected$ after an automatic reconnect so stores can refetch what they missed', async () => {
    await connect();
    const reconnected = vi.fn();
    service.reconnected$.subscribe(reconnected);

    hub.reconnected!();

    expect(reconnected).toHaveBeenCalledTimes(1);
  });

  it('never invokes hub methods: the server addresses the user group itself', async () => {
    await connect();
    expect(hub.connection!.invoke).not.toHaveBeenCalled();
  });

  it('stops the connection when the workspace becomes unavailable (sign-out)', async () => {
    await connect();
    const connection = hub.connection!;

    authenticated.set(false);
    TestBed.tick();

    expect(connection.stop).toHaveBeenCalled();
    expect(service.connected()).toBe(false);
  });

  it('a failed start leaves the service disconnected without throwing', async () => {
    hub.failStart = true;
    await connect();
    await Promise.resolve();
    expect(service.connected()).toBe(false);
  });

});
