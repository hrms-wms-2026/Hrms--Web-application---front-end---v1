import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { environment } from '@environments/environment';
import { AuthStore } from '../auth/state/auth.store';
import { PermissionService } from '../auth/state/permission.service';
import { TrayPresenceStore } from '../tray-presence/state/tray-presence.store';
import { INBOX_HUB_CONNECTION_FACTORY, InboxRealtimeService } from './inbox-realtime.service';

type Handler = (...args: unknown[]) => void;
type Fn = ReturnType<typeof vi.fn>;

const hub = {
  handlers: new Map<string, Handler>(),
  reconnected: null as (() => void) | null,
  closed: null as ((error?: Error) => void) | null,
  created: 0,
  options: null as Record<string, unknown> | null,
  url: '',
  connection: null as { on: Fn; onreconnected: Fn; onclose: Fn; start: Fn; stop: Fn; invoke: Fn } | null,
  failStart: false
};

function fakeFactory(url: string, options: Record<string, unknown>) {
  hub.url = url;
  hub.options = options;
  hub.created++;
  const connection = {
    on: vi.fn((name: string, handler: Handler) => hub.handlers.set(name, handler)),
    onreconnected: vi.fn((cb: () => void) => { hub.reconnected = cb; }),
    onclose: vi.fn((cb: (error?: Error) => void) => { hub.closed = cb; }),
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
    fakeDocument = { cookie: 'other=1; crownus_csrf=tok%2B1' };
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
    hub.created = 0;
    hub.closed = null;
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

  describe('single-host tenant query', () => {
    const mutableEnv = environment as unknown as { tenancyMode: string };
    let originalMode: string;

    beforeEach(() => {
      originalMode = mutableEnv.tenancyMode;
      sessionStorage.clear();
    });

    afterEach(() => {
      mutableEnv.tenancyMode = originalMode;
      sessionStorage.clear();
    });

    it('appends ?tenant=<slug> in single-host mode when a slug is stored', async () => {
      mutableEnv.tenancyMode = 'single-host';
      sessionStorage.setItem('crownus.singleHostTenant', 'acme');
      await connect();
      expect(hub.url).toMatch(/\/hubs\/inbox\?tenant=acme$/);
    });

    it('adds nothing without a stored slug', async () => {
      mutableEnv.tenancyMode = 'single-host';
      await connect();
      expect(hub.url).toMatch(/\/hubs\/inbox$/);
    });

    it('adds nothing in subdomain mode even with a stored slug', async () => {
      mutableEnv.tenancyMode = 'subdomain';
      sessionStorage.setItem('crownus.singleHostTenant', 'acme');
      await connect();
      expect(hub.url).toMatch(/\/hubs\/inbox$/);
    });
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

  it('re-emits message mutation, read marker and participant removal events', async () => {
    await connect();
    const updated = vi.fn();
    const deleted = vi.fn();
    const removed = vi.fn();
    const hidden = vi.fn();
    const read = vi.fn();
    service.messageUpdated$.subscribe(updated);
    service.messageDeleted$.subscribe(deleted);
    service.participantRemoved$.subscribe(removed);
    service.messageHidden$.subscribe(hidden);
    service.participantRead$.subscribe(read);

    hub.handlers.get('messageUpdated')!({ conversationId: 'c1', message: { id: 'm1' } });
    hub.handlers.get('messageDeleted')!({ conversationId: 'c1', messageId: 'm1' });
    hub.handlers.get('participantRemoved')!({ conversationId: 'c1', employeeId: 'e1' });
    hub.handlers.get('messageHidden')!({ conversationId: 'c1', messageId: 'm2' });
    hub.handlers.get('participantRead')!({ conversationId: 'c1', employeeId: 'e2', readAt: '2026-10-21T09:00:00Z' });

    expect(updated).toHaveBeenCalledWith({ conversationId: 'c1', message: { id: 'm1' } });
    expect(deleted).toHaveBeenCalledWith({ conversationId: 'c1', messageId: 'm1' });
    expect(removed).toHaveBeenCalledWith({ conversationId: 'c1', employeeId: 'e1' });
    expect(hidden).toHaveBeenCalledWith({ conversationId: 'c1', messageId: 'm2' });
    expect(read).toHaveBeenCalledWith({ conversationId: 'c1', employeeId: 'e2', readAt: '2026-10-21T09:00:00Z' });
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

  describe('after the connection is lost', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
    afterEach(() => vi.useRealTimers());

    it('reconnects with a fresh connection (fresh CSRF header) once auto-reconnect gives up, then emits reconnected$', async () => {
      await connect();
      const first = hub.connection!;
      const reconnected = vi.fn();
      service.reconnected$.subscribe(reconnected);

      fakeDocument.cookie = 'crownus_csrf=tok2';
      hub.closed!(new Error('gone'));
      expect(service.connected()).toBe(false);
      await vi.advanceTimersByTimeAsync(2000);

      expect(hub.created).toBe(2);
      expect(hub.connection).not.toBe(first);
      expect(hub.options).toMatchObject({ headers: { 'X-CSRF-Token': 'tok2' } });
      expect(service.connected()).toBe(true);
      expect(reconnected).toHaveBeenCalledTimes(1);
    });

    it('keeps retrying a failed start with backoff while the workspace stays ready', async () => {
      hub.failStart = true;
      await connect();
      expect(hub.created).toBe(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(hub.created).toBe(2);
      hub.failStart = false;
      await vi.advanceTimersByTimeAsync(5000);
      expect(hub.created).toBe(3);
      expect(service.connected()).toBe(true);
    });

    it('does not reconnect after sign-out', async () => {
      await connect();
      authenticated.set(false);
      TestBed.tick();
      hub.closed!();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(hub.created).toBe(1);
      expect(service.connected()).toBe(false);
    });
  });
});
