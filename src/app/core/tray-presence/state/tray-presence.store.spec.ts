import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrayPresenceApiService } from '../data-access/tray-presence-api.service';
import { TrayPresenceResponse } from '../models/tray-presence.model';
import { BrowserReloadService } from '../services/browser-reload.service';
import { TrayPresenceStore } from './tray-presence.store';

const disconnected: TrayPresenceResponse = {
  required: true,
  connected: false,
  grace_period_seconds: 60,
  server_time: '2026-08-27T10:00:00Z',
  presence_valid_until: null,
  device: null
};

const connected: TrayPresenceResponse = {
  required: true,
  connected: true,
  grace_period_seconds: 60,
  server_time: '2026-08-27T10:00:05Z',
  presence_valid_until: new Date(Date.now() + 300_000).toISOString(),
  device: {
    id: 'device-1',
    name: 'Buddy Laptop',
    last_seen_at: '2026-08-27T10:00:05Z'
  }
};

describe('TrayPresenceStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  function createStore(
    getStatus: ReturnType<typeof vi.fn>,
    generateActivationCode = vi.fn(() => of({ code: 'BCDF2345', expires_in_seconds: 600 }))
  ) {
    const api = {
      getStatus,
      getInstaller: vi.fn(),
      generateActivationCode
    };

    TestBed.configureTestingModule({
      providers: [
        TrayPresenceStore,
        { provide: TrayPresenceApiService, useValue: api },
        { provide: BrowserReloadService, useValue: { reloadCurrentUrl: vi.fn() } }
      ]
    });

    return TestBed.inject(TrayPresenceStore);
  }

  function setup(statuses: Array<TrayPresenceResponse | Error> = []) {
    const getStatus = vi.fn();
    for (const status of statuses) {
      getStatus.mockReturnValueOnce(
        status instanceof Error ? throwError(() => status) : of(status)
      );
    }
    return createStore(getStatus);
  }

  it('does not block the workspace before the first presence check completes', () => {
    const store = setup();

    expect(store.checkedOnce()).toBe(false);
    expect(store.isBlocking()).toBe(false);
  });

  it('shows the blocking gate after the first presence check fails', async () => {
    const store = setup([new Error('status unavailable')]);

    store.start();
    await vi.waitFor(() => expect(store.checkedOnce()).toBe(true));

    expect(store.isBlocking()).toBe(true);
  });

  it('renders protected content when the first presence response is connected', async () => {
    const store = setup([connected]);

    store.start();
    await vi.waitFor(() => expect(store.checkedOnce()).toBe(true));

    expect(store.checkedOnce()).toBe(true);
    expect(store.isBlocking()).toBe(false);
    expect(store.canRenderProtectedContent()).toBe(true);
  });

  it('blocks after a disconnected response and unblocks after a fresh tray heartbeat', async () => {
    const store = setup([disconnected, connected]);

    store.start();
    await vi.waitFor(() => expect(store.checkedOnce()).toBe(true));
    expect(store.isBlocking()).toBe(true);
    expect(store.canRenderProtectedContent()).toBe(false);

    await store.refresh();
    expect(store.isBlocking()).toBe(false);
    expect(store.canRenderProtectedContent()).toBe(true);
    expect(store.deviceName()).toBe('Buddy Laptop');
  });

  it('ignores an older status response that arrives after a newer response', async () => {
    const older = new Subject<TrayPresenceResponse>();
    const newer = new Subject<TrayPresenceResponse>();
    const getStatus = vi.fn()
      .mockReturnValueOnce(older as Observable<TrayPresenceResponse>)
      .mockReturnValueOnce(newer as Observable<TrayPresenceResponse>);
    const store = createStore(getStatus);

    store.start();
    const newerRefresh = store.refresh();
    newer.next(connected);
    newer.complete();
    await newerRefresh;

    older.next(disconnected);
    older.complete();
    await Promise.resolve();

    expect(store.phase()).toBe('connected');
    expect(store.isBlocking()).toBe(false);
    expect(store.canRenderProtectedContent()).toBe(true);
  });

  it('keeps an immediate lock when an in-flight connected response arrives later', async () => {
    const pendingStatus = new Subject<TrayPresenceResponse>();
    const store = createStore(vi.fn().mockReturnValueOnce(pendingStatus));

    store.start();
    store.lockImmediately();
    pendingStatus.next(connected);
    pendingStatus.complete();
    await Promise.resolve();

    expect(store.required()).toBe(true);
    expect(store.isBlocking()).toBe(true);
    expect(store.canRenderProtectedContent()).toBe(false);
  });

  it('does not let a late activation-code response re-lock a connected workspace', async () => {
    const activationCode = new Subject<{ code: string; expires_in_seconds: number }>();
    const getStatus = vi.fn()
      .mockReturnValueOnce(of(disconnected))
      .mockReturnValueOnce(of(connected));
    const generateActivationCode = vi.fn(() => activationCode);
    const store = createStore(getStatus, generateActivationCode);

    store.start();
    await vi.waitFor(() => expect(generateActivationCode).toHaveBeenCalledOnce());
    await store.refresh();
    expect(store.phase()).toBe('connected');

    activationCode.next({ code: 'BCDF2345', expires_in_seconds: 600 });
    activationCode.complete();
    await Promise.resolve();

    expect(store.phase()).toBe('connected');
    expect(store.canRenderProtectedContent()).toBe(true);
  });
});
