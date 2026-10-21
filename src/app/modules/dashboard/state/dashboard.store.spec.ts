import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardLayoutApiService } from '../data-access/dashboard-layout-api.service';
import { AvailableWidget, BootstrapWidget, DashboardBootstrap } from '../models/dashboard-layout.model';
import { DashboardStore } from './dashboard.store';

const size = { minW: 2, minH: 2, maxW: 12, maxH: 6 };

function widget(instanceId: string, widgetKey: string, x: number, y: number, w = 6, h = 2): BootstrapWidget {
  return {
    instanceId,
    widgetKey,
    title: widgetKey,
    layout: { x, y, w, h },
    size,
    dataState: { status: 'success', fetchedAt: null, error: null },
    data: null
  };
}

function bootstrapOf(widgets: BootstrapWidget[], layoutVersion = 3, breakpoint: 'desktop' | 'tablet' | 'mobile' = 'desktop'): DashboardBootstrap {
  return {
    id: 'dash-1',
    key: 'my-work',
    title: 'My Work',
    layoutVersion,
    grid: { breakpoint, columns: breakpoint === 'desktop' ? 12 : breakpoint === 'tablet' ? 6 : 4, rowHeight: 96, gap: 12 },
    widgets,
    hasAllowedGatedWidgets: true,
    capabilitiesUnavailable: false
  };
}

const availableList: AvailableWidget[] = [
  { key: 'a', title: 'A', description: '', size, defaultW: 6, defaultH: 2, placed: true },
  { key: 'b', title: 'B', description: '', size, defaultW: 6, defaultH: 2, placed: true },
  { key: 'c', title: 'C', description: '', size, defaultW: 4, defaultH: 3, placed: false },
  { key: 'd', title: 'D', description: '', size, defaultW: 3, defaultH: 2, placed: false }
];

function conflict(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 409, error: { code: 'VERSION_CONFLICT', currentVersion: 9 } });
}

describe('DashboardStore', () => {
  function setup(initial: BootstrapWidget[] = [widget('i-a', 'a', 0, 0), widget('i-b', 'b', 6, 0)]) {
    const api = {
      listMine: vi.fn().mockReturnValue(of([{ id: 'dash-1', key: 'my-work', title: 'My Work', layoutVersion: 3 }])),
      bootstrap: vi.fn().mockReturnValue(of(bootstrapOf(initial))),
      available: vi.fn().mockReturnValue(of(availableList)),
      addWidget: vi.fn(),
      removeWidget: vi.fn(),
      saveLayout: vi.fn(),
      reset: vi.fn()
    };
    const notifications = { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        DashboardStore,
        { provide: DashboardLayoutApiService, useValue: api },
        { provide: NotificationService, useValue: notifications }
      ]
    });
    return { store: TestBed.inject(DashboardStore), api, notifications };
  }

  async function loaded(initial?: BootstrapWidget[]) {
    const ctx = setup(initial);
    await ctx.store.load('my-work');
    return ctx;
  }

  it('load finds the dashboard by key then bootstraps and fetches available', async () => {
    const { store, api } = await loaded();
    expect(api.bootstrap).toHaveBeenCalledWith('dash-1', 'desktop');
    expect(api.available).toHaveBeenCalledWith('dash-1', 'desktop');
    expect(store.widgets().map(w => w.instanceId)).toEqual(['i-a', 'i-b']);
    expect(store.editing()).toBe(false);
  });

  it('cancel_discards_all_draft_changes', async () => {
    const { store } = await loaded();
    store.startEditing();
    store.remove('i-a');
    store.add('c');
    store.move('i-b', 0, 5);
    expect(store.widgets().map(w => w.widgetKey).sort()).toEqual(['b', 'c']);
    store.cancel();
    expect(store.editing()).toBe(false);
    expect(store.draft()).toEqual([]);
    expect(store.widgets().map(w => w.instanceId)).toEqual(['i-a', 'i-b']);
    expect(store.widgets()[1].layout).toEqual({ x: 6, y: 0, w: 6, h: 2 });
  });

  it('dispose_exits_editing_without_reloading', async () => {
    const { store, api } = await loaded();
    await store.setBreakpoint('tablet');
    store.startEditing();
    store.remove('i-a');
    api.bootstrap.mockClear();
    store.dispose();
    expect(store.editing()).toBe(false);
    expect(store.draft()).toEqual([]);
    expect(api.bootstrap).not.toHaveBeenCalled();
  });

  it('no_api_call_during_move_or_resize', async () => {
    const { store, api } = await loaded();
    const calls = () => api.addWidget.mock.calls.length + api.removeWidget.mock.calls.length + api.saveLayout.mock.calls.length + api.reset.mock.calls.length;
    store.startEditing();
    store.move('i-b', 0, 4);
    store.resize('i-a', 4, 3);
    store.add('c');
    store.remove('i-b');
    expect(calls()).toBe(0);
    expect(api.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('draft add uses the available default size and a temp id, and compacts', async () => {
    const { store } = await loaded();
    store.startEditing();
    store.add('c');
    const added = store.draft().find(w => w.widgetKey === 'c')!;
    expect(added.instanceId).toBe('new:c');
    expect(added.layout.w).toBe(4);
    expect(added.layout.h).toBe(3);
    expect(added.layout.y).toBe(2);
    store.remove('i-a');
    store.remove('i-b');
    expect(store.draft().find(w => w.widgetKey === 'c')!.layout.y).toBe(0);
  });

  it('save_sends_deletes_then_adds_then_one_put', async () => {
    const { store, api } = await loaded();
    const order: string[] = [];
    api.removeWidget.mockImplementation((_id: string, inst: string, v: number) => {
      order.push(`del:${inst}@${v}`);
      return of({ layoutVersion: v + 1 });
    });
    api.addWidget.mockImplementation((_id: string, key: string, v: number, rect?: unknown) => {
      order.push(`add:${key}@${v}:${rect ? 'rect' : 'norect'}`);
      return of({ instanceId: `real-${key}`, layoutVersion: v + 1 });
    });
    api.saveLayout.mockImplementation((_id: string, bp: string, v: number) => {
      order.push(`put:${bp}@${v}`);
      return of({ layoutVersion: v + 1 });
    });
    api.bootstrap.mockReturnValue(of(bootstrapOf([widget('i-b', 'b', 0, 0), widget('real-c', 'c', 6, 0, 4, 3)], 7)));

    store.startEditing();
    store.remove('i-a');
    store.add('c');
    await store.save();

    expect(order).toEqual(['del:i-a@3', 'add:c@4:rect', 'put:desktop@5']);
    expect(api.saveLayout).toHaveBeenCalledTimes(1);
    const items = api.saveLayout.mock.calls[0][3] as { instanceId: string; x: number; y: number; w: number; h: number }[];
    expect(items.map(i => i.instanceId).sort()).toEqual(['i-b', 'real-c']);
    expect(items.every(i => !i.instanceId.startsWith('new:'))).toBe(true);
    const added = api.addWidget.mock.calls[0][3];
    expect(added).toEqual(expect.objectContaining({ w: 4, h: 3 }));
    expect(api.bootstrap).toHaveBeenCalledTimes(2);
    expect(store.editing()).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.widgets().map(w => w.instanceId)).toEqual(['i-b', 'real-c']);
  });

  it('save_with_no_changes_exits_editing_without_calls', async () => {
    const { store, api } = await loaded();
    store.startEditing();
    await store.save();
    expect(store.editing()).toBe(false);
    expect(api.saveLayout).not.toHaveBeenCalled();
    expect(api.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('non-desktop add sends no rect', async () => {
    const { store, api } = await loaded();
    api.bootstrap.mockReturnValue(of(bootstrapOf([widget('i-a', 'a', 0, 0, 4, 2)], 3, 'tablet')));
    await store.setBreakpoint('tablet');
    api.addWidget.mockReturnValue(of({ instanceId: 'real-c', layoutVersion: 4 }));
    api.saveLayout.mockReturnValue(of({ layoutVersion: 5 }));
    store.startEditing();
    store.add('c');
    await store.save();
    expect(api.addWidget.mock.calls[0][3]).toBeUndefined();
    expect(api.saveLayout.mock.calls[0][1]).toBe('tablet');
  });

  it('conflict_reloads_and_exits_editing', async () => {
    const { store, api, notifications } = await loaded();
    api.removeWidget.mockReturnValue(throwError(() => conflict()));
    store.startEditing();
    store.remove('i-a');
    await store.save();
    expect(notifications.warning).toHaveBeenCalledWith('Your dashboard changed in another tab or device — reloaded.');
    expect(api.bootstrap).toHaveBeenCalledTimes(2);
    expect(store.editing()).toBe(false);
    expect(store.draft()).toEqual([]);
    expect(store.saving()).toBe(false);
  });

  it('non-409 error stays in editing, sets error and toasts', async () => {
    const { store, api, notifications } = await loaded();
    api.saveLayout.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.startEditing();
    store.move('i-b', 0, 3);
    await store.save();
    expect(store.editing()).toBe(true);
    expect(store.error()).not.toBeNull();
    expect(notifications.error).toHaveBeenCalled();
    expect(store.saving()).toBe(false);
  });

  it('available_excludes_placed_and_draft_added', async () => {
    const { store } = await loaded();
    expect(store.available().map(a => a.key)).toEqual(['c', 'd']);
    store.startEditing();
    store.add('c');
    expect(store.available().map(a => a.key)).toEqual(['d']);
    store.remove('i-a');
    expect(store.available().map(a => a.key)).toEqual(['a', 'd']);
  });

  it('breakpoint change while not editing re-bootstraps; while editing keeps the draft', async () => {
    const { store, api } = await loaded();
    await store.setBreakpoint('tablet');
    expect(api.bootstrap).toHaveBeenLastCalledWith('dash-1', 'tablet');
    api.bootstrap.mockClear();
    store.startEditing();
    store.remove('i-a');
    await store.setBreakpoint('mobile');
    expect(api.bootstrap).not.toHaveBeenCalled();
    expect(store.editing()).toBe(true);
    expect(store.draft().map(w => w.instanceId)).toEqual(['i-b']);
  });

  it('resetToDefault calls reset with the current version, re-bootstraps and exits editing', async () => {
    const { store, api } = await loaded();
    api.reset.mockReturnValue(of({ layoutVersion: 4 }));
    store.startEditing();
    await store.resetToDefault();
    expect(api.reset).toHaveBeenCalledWith('dash-1', 3);
    expect(api.bootstrap).toHaveBeenCalledTimes(2);
    expect(store.editing()).toBe(false);
  });

  it('keeps the latest refresh when overlapping ones resolve out of order', async () => {
    const { store, api } = await loaded();
    const slow = new Subject<DashboardBootstrap>();
    api.bootstrap.mockReturnValueOnce(slow).mockReturnValueOnce(of(bootstrapOf([widget('m', 'a', 0, 0, 4, 2)], 5, 'mobile')));
    const first = store.setBreakpoint('tablet');
    const second = store.setBreakpoint('mobile');
    await second;
    slow.next(bootstrapOf([widget('t', 'a', 0, 0, 6, 2)], 4, 'tablet'));
    slow.complete();
    await first;
    expect(store.bootstrap()?.grid.breakpoint).toBe('mobile');
    expect(store.widgets()[0].instanceId).toBe('m');
  });

  it('double reset sends only one reset call', async () => {
    const { store, api } = await loaded();
    const gate = new Subject<{ layoutVersion: number }>();
    api.reset.mockReturnValue(gate);
    const a = store.resetToDefault();
    const b = store.resetToDefault();
    gate.next({ layoutVersion: 4 });
    gate.complete();
    await Promise.all([a, b]);
    expect(api.reset).toHaveBeenCalledTimes(1);
  });

  it('save succeeds but trailing reload fails: exits editing, no save-failure toast', async () => {
    const { store, api, notifications } = await loaded();
    api.saveLayout.mockReturnValue(of({ layoutVersion: 4 }));
    store.startEditing();
    store.move('i-b', 0, 3);
    api.bootstrap.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await store.save();
    expect(store.editing()).toBe(false);
    expect(notifications.error).toHaveBeenCalledWith('Saved, but could not reload the dashboard.');
    expect(notifications.error).not.toHaveBeenCalledWith('Could not save the dashboard.');
  });

  it('keeps the saved layout on screen while reloading and after a failed reload', async () => {
    const { store, api } = await loaded();
    api.saveLayout.mockReturnValue(of({ layoutVersion: 4 }));
    store.startEditing();
    store.move('i-b', 0, 3);
    const savedLayout = store.draft().map(w => ({ id: w.instanceId, layout: w.layout }));
    const gate = new Subject<DashboardBootstrap>();
    api.bootstrap.mockReturnValue(gate);
    const pending = store.save();
    await Promise.resolve();
    await Promise.resolve();
    const snapshot = () => store.widgets().map(w => ({ id: w.instanceId, layout: w.layout }));
    expect(store.editing()).toBe(false);
    expect(snapshot()).toEqual(savedLayout);
    gate.error(new HttpErrorResponse({ status: 500 }));
    await pending;
    expect(snapshot()).toEqual(savedLayout);
    expect(store.bootstrap()?.layoutVersion).toBe(4);
  });

  it('a stale refresh failure does not set error after a newer refresh succeeded', async () => {
    const { store, api } = await loaded();
    const slow = new Subject<DashboardBootstrap>();
    api.bootstrap.mockReturnValueOnce(slow).mockReturnValueOnce(of(bootstrapOf([widget('m', 'a', 0, 0, 4, 2)], 5, 'mobile')));
    const first = store.setBreakpoint('tablet');
    await store.setBreakpoint('mobile');
    slow.error(new HttpErrorResponse({ status: 500 }));
    await first;
    expect(store.error()).toBeNull();
    expect(store.bootstrap()?.grid.breakpoint).toBe('mobile');
  });

  it('a breakpoint refresh landing after editing started does not move the draft to the new breakpoint', async () => {
    const { store, api } = await loaded();
    const slow = new Subject<DashboardBootstrap>();
    api.bootstrap.mockReturnValueOnce(slow);
    const crossing = store.setBreakpoint('tablet');
    store.startEditing(); // user clicks Customize before the tablet bootstrap returns
    store.move('i-b', 0, 3);
    slow.next(bootstrapOf([widget('i-a', 'a', 0, 0, 6, 2), widget('i-b', 'b', 0, 2, 6, 2)], 8, 'tablet'));
    slow.complete();
    await crossing;

    expect(store.editing()).toBe(true);
    expect(store.bootstrap()?.grid.breakpoint).toBe('desktop');
    expect(store.bootstrap()?.layoutVersion).toBe(3);

    api.saveLayout.mockReturnValue(of({ layoutVersion: 4 }));
    api.bootstrap.mockReturnValue(of(bootstrapOf([widget('i-a', 'a', 0, 0, 6, 2)], 4, 'tablet')));
    await store.save();
    expect(api.saveLayout).toHaveBeenCalledTimes(1);
    expect(api.saveLayout.mock.calls[0][1]).toBe('desktop');
    expect(api.saveLayout.mock.calls[0][2]).toBe(3);
    // after the save the page re-bootstraps at the real (tablet) breakpoint
    expect(api.bootstrap).toHaveBeenLastCalledWith('dash-1', 'tablet');
    expect(store.bootstrap()?.grid.breakpoint).toBe('tablet');
  });

  it('a reload (My Team "Try again") while editing does not replace the bootstrap under the draft', async () => {
    const { store, api } = await loaded();
    store.startEditing();
    store.move('i-b', 0, 3);
    api.listMine.mockClear();
    api.bootstrap.mockReturnValue(of(bootstrapOf([widget('i-a', 'a', 0, 0)], 9)));
    await store.load('my-work');
    expect(store.editing()).toBe(true);
    expect(store.bootstrap()?.layoutVersion).toBe(3);
    expect(store.draft().map(w => w.instanceId)).toEqual(['i-a', 'i-b']);

    api.saveLayout.mockReturnValue(of({ layoutVersion: 4 }));
    await store.save();
    expect(api.saveLayout.mock.calls[0][1]).toBe('desktop');
    expect(api.saveLayout.mock.calls[0][2]).toBe(3);
  });

  it('a refresh skipped while editing is applied when editing is cancelled', async () => {
    const { store, api } = await loaded();
    const slow = new Subject<DashboardBootstrap>();
    api.bootstrap.mockReturnValueOnce(slow);
    const pending = store.load('my-work');
    store.startEditing();
    slow.next(bootstrapOf([widget('i-a', 'a', 0, 0)], 9));
    slow.complete();
    await pending;
    expect(store.bootstrap()?.layoutVersion).toBe(3);
    api.bootstrap.mockReturnValue(of(bootstrapOf([widget('i-a', 'a', 0, 0)], 9)));
    await store.cancel();
    expect(store.bootstrap()?.layoutVersion).toBe(9);
  });

  it('moving a widget down one row (keyboard ArrowDown) swaps it with the neighbour below', async () => {
    const { store } = await loaded([widget('i-a', 'a', 0, 0, 12, 2), widget('i-b', 'b', 0, 2, 12, 3)]);
    store.startEditing();
    store.move('i-a', 0, 1);
    expect(store.draft().map(w => [w.instanceId, w.layout.y])).toEqual([['i-a', 3], ['i-b', 0]]);
  });

  it('validation errors are shown as plain messages, not raw codes', async () => {
    const { store, api, notifications } = await loaded();
    api.saveLayout.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { title: 'Unprocessable Entity', detail: 'OVERLAP,SIZE_NOT_ALLOWED', code: 'OVERLAP', codes: ['OVERLAP', 'SIZE_NOT_ALLOWED'] }
          })
      )
    );
    store.startEditing();
    store.move('i-b', 0, 3);
    await store.save();
    const message = store.error()!;
    expect(message).not.toMatch(/OVERLAP|SIZE_NOT_ALLOWED|Unprocessable/);
    expect(message).toBe("Could not save the dashboard: some widgets overlap, a widget has a size that isn't allowed.");
    expect(notifications.error).toHaveBeenCalledWith(message);
  });

  it('an unknown code or a bare status title falls back to the plain message', async () => {
    const { store, api } = await loaded();
    api.saveLayout.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { title: 'Unprocessable Entity', detail: 'SOMETHING_NEW', code: 'SOMETHING_NEW', codes: ['SOMETHING_NEW'] } }))
    );
    store.startEditing();
    store.move('i-b', 0, 3);
    await store.save();
    expect(store.error()).toBe('Could not save the dashboard.');
    api.saveLayout.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { title: 'Forbidden' } })));
    await store.save();
    expect(store.error()).toBe('Could not save the dashboard.');
  });

  it('LAYOUT_SET_MISMATCH (widgets changed during the edit) reloads and exits editing like a conflict', async () => {
    const { store, api, notifications } = await loaded();
    api.saveLayout.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'LAYOUT_SET_MISMATCH', code: 'LAYOUT_SET_MISMATCH', codes: ['LAYOUT_SET_MISMATCH'] } }))
    );
    store.startEditing();
    store.move('i-b', 0, 3);
    await store.save();
    expect(notifications.warning).toHaveBeenCalledWith('Your available widgets changed — reloaded.');
    expect(notifications.error).not.toHaveBeenCalled();
    expect(store.editing()).toBe(false);
    expect(store.error()).toBeNull();
    expect(api.bootstrap).toHaveBeenCalledTimes(2);
  });

  it('draft edits are ignored while saving', async () => {
    const { store } = await loaded();
    store.startEditing();
    const before = store.draft();
    store.saving.set(true);
    store.add('c');
    store.remove('i-a');
    store.move('i-b', 0, 4);
    store.resize('i-a', 4, 3);
    expect(store.draft()).toBe(before);
  });

  it('load failure sets error', async () => {
    const { store, api } = setup();
    api.listMine.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await store.load('my-work');
    expect(store.error()).not.toBeNull();
    expect(store.bootstrap()).toBeNull();
  });
});
