import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';
import { PlannerFocusResponse, PlannerRangeResponse } from '../../work/planner/models/planner.models';
import { PlannerAvailability, PlannerAvailabilityService } from '../../work/planner/state/planner-availability.service';
import { PlannerDragService } from './planner-drag.service';
import { PlannerLayerStore } from './planner-layer.store';

const base = `${environment.apiUrl}/planner`;
const range: PlannerRangeResponse = {
  timezone: 'Asia/Colombo', today: '2026-11-02',
  days: [{ date: '2026-11-02', editable: true, workWindow: null, blocks: [], blockMinutes: 0, workingMinutes: 0 }],
};
const focus: PlannerFocusResponse = {
  today: '2026-11-02', weekEnd: '2026-11-08',
  groups: [
    { reason: 'overdue', count: 2, items: [] }, { reason: 'due_today', count: 1, items: [] },
    { reason: 'due_this_week', count: 0, items: [] }, { reason: 'backlog', count: 6, items: [] },
  ],
};
const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('PlannerLayerStore', () => {
  let store: InstanceType<typeof PlannerLayerStore>;
  let http: HttpTestingController;
  const state = signal<PlannerAvailability>('on');
  const availability = { state, markAvailable: vi.fn((on: boolean) => state.set(on ? 'on' : 'off')) };
  const notify = { error: vi.fn() };

  beforeEach(() => {
    state.set('on');
    availability.markAvailable.mockClear();
    notify.error.mockClear();
    TestBed.configureTestingModule({
      providers: [
        PlannerLayerStore, provideHttpClient(), provideHttpClientTesting(),
        { provide: PlannerAvailabilityService, useValue: availability },
        { provide: NotificationService, useValue: notify },
      ],
    });
    store = TestBed.inject(PlannerLayerStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function loadWeek(): Promise<void> {
    const work = store.load('2026-11-02', '2026-11-08');
    http.expectOne((r) => r.url === `${base}/me/range`).flush(range);
    http.expectOne(`${base}/me/focus`).flush(focus);
    await work;
  }

  it('does nothing while the planner is off', async () => {
    state.set('off');

    await store.load('2026-11-02', '2026-11-08');

    http.expectNone(() => true);
    expect(store.active()).toBe(false);
  });

  it('loads the range and the focus list together', async () => {
    await loadWeek();

    expect(store.active()).toBe(true);
    expect(store.dayByDate().get('2026-11-02')?.editable).toBe(true);
    expect(store.focusCount()).toBe(9);
  });

  it('hides the layer and marks the planner off on 503 planner_disabled', async () => {
    const work = store.load('2026-11-02', '2026-11-08');
    http.expectOne((r) => r.url === `${base}/me/range`).flush({ code: 'planner_disabled' }, { status: 503, statusText: 'Off' });
    http.expectOne(`${base}/me/focus`).flush({ code: 'planner_disabled' }, { status: 503, statusText: 'Off' });
    await work;

    expect(store.active()).toBe(false);
    expect(availability.markAvailable).toHaveBeenCalledWith(false);
  });

  it('refetches the last range after a write', async () => {
    await loadWeek();

    const write = store.createBlock('t1', '2026-11-02T03:30:00Z', '2026-11-02T04:30:00Z');
    http.expectOne(`${base}/me/blocks`).flush(null);
    await tick();
    const refetch = http.expectOne((r) => r.url === `${base}/me/range`);
    expect([refetch.request.params.get('from'), refetch.request.params.get('to')]).toEqual(['2026-11-02', '2026-11-08']);
    refetch.flush(range);
    http.expectOne(`${base}/me/focus`).flush(focus);

    expect(await write).toBe(true);
  });

  it('keeps the plan and shows the message when a write is refused', async () => {
    await loadWeek();

    const write = store.moveBlock('b1', 'a', 'b');
    http.expectOne(`${base}/me/blocks/b1`).flush({ code: 'planner_block_overlap' }, { status: 409, statusText: 'Conflict' });

    expect(await write).toBe(false);
    expect(store.error()).toBe('This overlaps another planned block.');
    expect(notify.error).toHaveBeenCalledWith('This overlaps another planned block.');
  });
  it('keeps the newest range when an older response arrives last', async () => {
    const older = store.load('2026-10-26', '2026-11-01');
    const newer = store.load('2026-11-02', '2026-11-08');
    const [oldRange, newRange] = http.match((r) => r.url === `${base}/me/range`);
    const [oldFocus, newFocus] = http.match(`${base}/me/focus`);
    newRange.flush(range);
    newFocus.flush(focus);
    await newer;
    oldRange.flush({ ...range, days: [{ ...range.days[0], date: '2026-10-26' }] });
    oldFocus.flush(focus);
    await older;

    expect([...store.dayByDate().keys()]).toEqual(['2026-11-02']);
  });
});

describe('PlannerDragService', () => {
  it('carries the dragged task until the drag ends', () => {
    const drag = new PlannerDragService();

    drag.start({ taskId: 't1', projectId: 'p1', title: 'Fix', remainingMinutes: 90 } as never);
    expect(drag.dragging()).toEqual({ taskId: 't1', projectId: 'p1', title: 'Fix', minutes: 90 });
    drag.end();
    expect(drag.dragging()).toBeNull();
  });
});
