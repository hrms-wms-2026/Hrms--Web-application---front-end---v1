import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamScheduleApiService } from '../../data-access/team-schedule-api.service';
import { TeamScheduleItem, TeamScheduleResponse, TeamScheduleWeekResponse } from '../../models/team-schedule.model';
import { TeamScheduleWeekStore } from '../../state/team-schedule-week.store';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { at, scheduleMember, scheduleResponse, weekResponse } from '../../utils/team-schedule.testing';
import { TeamScheduleDetailDialogComponent } from './team-schedule-detail-dialog.component';

const ranked = scheduleMember({
  displayName: 'Ada',
  rank: 1,
  score: 70,
  itemCompletionPercent: 50,
  timeCoveragePercent: 100,
  notRankedReason: 'none',
  plannedTaskMinutes: 60,
  items: [
    {
      kind: 'task',
      taskId: 't1',
      title: 'Write report',
      start: at(9),
      end: at(10),
      status: 'completed',
      isPrivate: false,
    },
    {
      kind: 'meeting',
      taskId: 'm1',
      title: 'Private meeting',
      start: at(10),
      end: at(11),
      status: 'finished',
      isPrivate: true,
    },
  ],
  conflicts: [
    {
      kind: 'block_meeting',
      start: at(9, 30),
      end: at(10),
      firstTitle: 'Write report',
      secondTitle: 'Private meeting',
    },
  ],
});
const onLeave = scheduleMember({ displayName: 'Cat', notRankedReason: 'on_leave' });
const noPlan = scheduleMember({
  displayName: 'Bob',
  clockedMinutes: 120,
  noPlanMinutes: 120,
  unscheduled: [
    { taskId: 't2', title: 'Fix bug', start: at(13), end: at(15), minutes: 120, kind: 'no_plan' },
  ],
});

describe('TeamScheduleDetailDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  const WEEK = weekResponse(
    {
      members: [
        { employeeId: 'emp-Ada', displayName: 'Ada', avatarFileId: null, plannedMinutes: 600, clockedMinutes: 420, scheduledMinutes: 300, unscheduledMinutes: 120, coveragePercent: 75 },
        { employeeId: 'emp-Bob', displayName: 'Bob', avatarFileId: null, plannedMinutes: 0, clockedMinutes: 240, scheduledMinutes: 0, unscheduledMinutes: 240, coveragePercent: null },
      ],
      totals: { plannedMinutes: 600, clockedMinutes: 660, scheduledMinutes: 300, unscheduledMinutes: 360, coveragePercent: 75 },
      previous: { plannedMinutes: 480, clockedMinutes: 600, scheduledMinutes: 240, unscheduledMinutes: 360, coveragePercent: 70 },
    },
    [{ plannedTaskMinutes: 300, scheduledMinutes: 200, noPlanMinutes: 60, clockedMinutes: 260 }],
  );

  async function setup(data: TeamScheduleResponse, week: TeamScheduleWeekResponse = WEEK) {
    const getTeamDay = vi.fn((date: string | null) => of({ ...data, date: date ?? data.date }));
    const getTeamWeek = vi.fn((weekStart: string | null) => of({ ...week, weekStart: weekStart ?? week.weekStart }));
    await TestBed.configureTestingModule({
      imports: [TeamScheduleDetailDialogComponent],
      providers: [
        provideRouter([]),
        TeamScheduleStore,
        TeamScheduleWeekStore,
        { provide: TeamScheduleApiService, useValue: { getTeamDay, getTeamWeek } },
      ],
    }).compileComponents();
    const store = TestBed.inject(TeamScheduleStore);
    store.seed(data);
    const fixture = TestBed.createComponent(TeamScheduleDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return { fixture, store, getTeamDay, getTeamWeek, doc: fixture.nativeElement.ownerDocument as Document };
  }

  const q = (doc: Document, id: string) => doc.querySelector(`[data-testid="${id}"]`);

  it('next day is disabled at today; previous loads yesterday and then next comes back to today', async () => {
    const { fixture, doc, getTeamDay, store } = await setup(scheduleResponse([ranked]));

    expect((q(doc, 'tsd-next') as HTMLButtonElement).disabled).toBe(true);
    expect(q(doc, 'tsd-date')!.textContent).toContain('Today');

    (q(doc, 'tsd-prev') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getTeamDay).toHaveBeenLastCalledWith('2026-10-28');
    expect((q(doc, 'tsd-next') as HTMLButtonElement).disabled).toBe(false);

    (q(doc, 'tsd-next') as HTMLButtonElement).click();
    expect(getTeamDay).toHaveBeenLastCalledWith(null);
    expect(store.date()).toBeNull();
  });

  it('pages every per-person list 10 at a time, each list on its own, and a search starts again at page 1', async () => {
    const people = Array.from({ length: 12 }, (_, i) =>
      scheduleMember({ employeeId: `e${i}`, displayName: `Person ${String(i + 1).padStart(2, '0')}` }),
    );
    const { fixture, doc } = await setup(scheduleResponse(people));
    const rows = () => [...doc.querySelectorAll('[data-testid="tsd-row"]')];
    const pager = (list: string) => doc.querySelector(`[data-testid="tsd-pager"][data-list="${list}"]`)!;
    const next = (list: string) => [...pager(list).querySelectorAll('button')].find((b) => b.textContent!.includes('Next'))!;

    expect(rows()).toHaveLength(10);
    expect(doc.querySelectorAll('[data-testid="tsd-rank-row"]')).toHaveLength(10);
    expect(pager('table').textContent).toContain('Page 1 of 2');

    next('table').click();
    fixture.detectChanges();
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('11');
    expect(rows()[0].textContent).toContain('Person 11');
    expect(next('table').disabled).toBe(true);
    // The ranking keeps its own page.
    expect(pager('ranking').textContent).toContain('Page 1 of 2');

    fixture.componentInstance.search.set('Person');
    fixture.detectChanges();
    expect(pager('table').textContent).toContain('Page 1 of 2');
    expect(rows()).toHaveLength(10);
  });

  it('no pager when everyone fits on one page', async () => {
    const { doc } = await setup(scheduleResponse([ranked, onLeave, noPlan]));
    expect(q(doc, 'tsd-pager')).toBeNull();
  });

  it('the Team schedule table has a colour guide for every kind of block', async () => {
    const { doc } = await setup(scheduleResponse([ranked, onLeave, noPlan]));
    const guide = q(doc, 'tsd-schedule-legend');
    expect(guide).toBeTruthy();
    const labels = [...guide!.querySelectorAll(':scope > span')].map((s) => s.textContent?.trim());
    expect(labels).toEqual([
      'Completed',
      'In progress',
      'Pending',
      'Meeting',
      'Break',
      'Unscheduled',
      'On leave',
      'Cancelled',
    ]);
  });

  it('today the Team schedule table shows a current-time line in every row and a time badge on the axis', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, 11, 30));
    try {
      const { doc } = await setup(scheduleResponse([ranked, onLeave, noPlan]));
      const badge = q(doc, 'tsd-now') as HTMLElement | null;
      expect(badge?.textContent?.trim()).toBe('11:30 AM');
      const lines = [...doc.querySelectorAll('[data-testid="tsd-now-line"]')] as HTMLElement[];
      expect(lines.length).toBe(3);
      expect(lines[0].style.left).toBe(badge!.style.left);
      expect(q(doc, 'tsd-schedule-legend')?.textContent).toContain('Now');
    } finally {
      vi.useRealTimers();
    }
  });

  it('no current-time line when the clock is outside the shown day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 3, 11, 30));
    try {
      const { doc } = await setup(scheduleResponse([ranked, onLeave, noPlan]));
      expect(q(doc, 'tsd-now')).toBeNull();
      expect(doc.querySelectorAll('[data-testid="tsd-now-line"]').length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ranking shows both parts with the score, and "Not ranked · reason" otherwise', async () => {
    const { doc } = await setup(scheduleResponse([ranked, onLeave, noPlan]));

    const rows = [...doc.querySelectorAll('[data-testid="tsd-rank-row"]')].map((r) =>
      r.textContent!.replace(/\s+/g, ' ').trim(),
    );
    // The score as a percentage only; its parts sit in its tooltip.
    expect(q(doc, 'tsd-score')!.textContent!.trim()).toBe('70%');
    expect(q(doc, 'tsd-score')!.getAttribute('title')).toBe('Items 50% · Time 100%');
    expect(rows[1]).toContain('Not ranked · On leave');
    expect(rows[2]).toContain('No plan');
    expect(rows[2]).toContain('Not ranked · Nothing due yet');
    expect(rows[2]).toContain('Unscheduled 2h');
  });

  it('done is the items-done percent; "—" without a plan, never 0%', async () => {
    const { doc } = await setup(scheduleResponse([onLeave, ranked]));
    const completion = [...doc.querySelectorAll('[data-testid="tsd-completion"]')].map((c) => c.textContent!.trim());
    expect(completion).toEqual(['—', '50%']);
  });

  it('day tiles are hours: planned, completed, in progress, pending and meetings, with % of planned', async () => {
    const item = (taskId: string, kind: TeamScheduleItem['kind'], status: TeamScheduleItem['status'], from: string, to: string): TeamScheduleItem =>
      ({ kind, taskId, title: taskId, start: from, end: to, status, isPrivate: false });
    const busy = scheduleMember({
      displayName: 'Busy',
      items: [
        item('done', 'task', 'completed', at(9), at(10)),
        item('doing', 'task', 'in_progress', at(10), at(11, 30)),
        item('todo', 'task', 'pending', at(13), at(13, 30)),
        item('unclocked', 'task', 'scheduled_not_clocked', at(14), at(14, 30)),
        item('sync', 'meeting', 'finished', at(11, 30), at(12)),
        item('dropped', 'meeting', 'cancelled', at(15), at(16)),
      ],
    });
    const { doc } = await setup(scheduleResponse([busy]));

    // Cancelled meetings are left out: 1h + 1h 30m + 30m + 30m + 30m = 4h.
    expect(q(doc, 'tsd-tile-total')!.textContent!.trim()).toBe('4h');
    expect(q(doc, 'tsd-tile-completed')!.textContent!.trim()).toBe('1h');
    expect(q(doc, 'tsd-tile-completed')!.closest('[data-testid="kpi-tile"]')!.textContent!).toContain('25');
    expect(q(doc, 'tsd-tile-progress')!.textContent!.trim()).toBe('1h 30m');
    expect(q(doc, 'tsd-tile-pending')!.textContent!.trim()).toBe('1h');
    expect(q(doc, 'tsd-tile-meetings')!.textContent!.trim()).toBe('30m');
  });

  it('day table: load against capacity, planned and actual, an Open plan link; side summary and top workload', async () => {
    const busy = { ...ranked, plannedTaskMinutes: 465, plannedMeetingMinutes: 60, expectedMinutes: 480, scheduledMinutes: 200, noPlanMinutes: 30 };
    const { doc } = await setup(scheduleResponse([busy, noPlan]));

    const load = q(doc, 'tsd-load')!;
    expect(load.textContent!.trim()).toBe('8h 45m / 8h');
    expect(load.classList).toContain('tsd-load--over');
    expect(q(doc, 'tsd-badge-not-planned')).toBeTruthy();
    expect(q(doc, 'tsd-actual')!.textContent!.trim()).toBe('3h 50m');
    expect(q(doc, 'tsd-open-plan')!.getAttribute('href')).toContain('person=');
    expect(q(doc, 'tsd-summary')!.textContent!.replace(/\s+/g, ' ')).toContain('Over capacity1');
    expect(q(doc, 'tsd-top-workload')!.textContent).toContain('109% · 8h 45m');
    // Ranking and planned vs actual are one table: actual 3h 50m against 8h 45m planned is 4h 55m behind.
    const diff = q(doc, 'tsd-diff')!;
    expect(diff.textContent!.trim()).toBe('−4h 55m');
    expect(diff.querySelector('.tsd-diff--behind')).toBeTruthy();
    // The double bar: planned (the page's largest, so full width) over actual split by in plan / outside / no plan.
    expect((q(doc, 'tsd-pa-planned') as HTMLElement).style.width).toBe('100%');
    expect((q(doc, 'tsd-pa-actual')!.firstElementChild as HTMLElement).style.width).toBe('38.1%');
  });

  it('week mode loads week store and steps by 7 days', async () => {
    const { fixture, doc, getTeamWeek } = await setup(scheduleResponse([ranked, noPlan]));

    (q(doc, 'tsd-mode-week') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getTeamWeek).toHaveBeenCalledWith(null);
    expect(q(doc, 'tsd-week-chart')).toBeTruthy();
    expect(q(doc, 'pa-tile-planned')!.textContent!.trim()).toBe('10h');
    expect(q(doc, 'tsd-tile-coverage')!.textContent!.trim()).toBe('75%');
    expect(doc.querySelectorAll('[data-testid="tsd-week-row"]').length).toBe(2);

    (q(doc, 'tsd-prev') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getTeamWeek).toHaveBeenLastCalledWith('2026-10-19');
  });

  it('week is the same ranking table: ranked by coverage, double bar, planned, actual and difference', async () => {
    const member = (employeeId: string, displayName: string, coveragePercent: number | null, planned: number, clocked: number) => ({
      employeeId,
      displayName,
      avatarFileId: null,
      plannedMinutes: planned,
      clockedMinutes: clocked,
      scheduledMinutes: clocked,
      unscheduledMinutes: 0,
      coveragePercent,
    });
    const week = weekResponse({
      members: [
        member('a', 'Low', 40, 600, 240),
        member('b', 'None', null, 0, 0),
        member('c', 'High', 90, 300, 360),
      ],
    });
    const { fixture, doc } = await setup(scheduleResponse([ranked]), week);
    (q(doc, 'tsd-mode-week') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = [...doc.querySelectorAll('[data-testid="tsd-week-row"]')];
    expect(rows.map((r) => r.querySelector('.tsd-name')!.textContent!.trim())).toEqual(['High', 'Low', 'None']);
    expect(rows.map((r) => r.querySelector('.tsd-rank')!.textContent!.trim())).toEqual(['1', '2', '—']);
    expect(rows[0].querySelector('[data-testid="tsd-week-coverage"]')!.textContent!.trim()).toBe('90%');
    expect(rows[2].textContent).toContain('Not ranked');
    // High worked 1h over plan, Low 6h under; None has neither, so "—".
    expect(rows.map((r) => r.querySelector('[data-testid="tsd-week-diff"]')!.textContent!.trim())).toEqual(['+1h', '−6h', '—']);
    expect(doc.querySelectorAll('[data-testid="tsd-week-pa"]')).toHaveLength(3);
  });

  it('future week arrow disabled', async () => {
    const { fixture, doc } = await setup(scheduleResponse([ranked]));

    (q(doc, 'tsd-mode-week') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((q(doc, 'tsd-next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('status filter and search narrow both tables', async () => {
    const working = { ...ranked, presenceStatus: 'working' };
    const { fixture, doc } = await setup(scheduleResponse([working, noPlan]));
    const dayNames = () => [...doc.querySelectorAll('[data-testid="tsd-row"] .tsd-name')].map((n) => n.textContent!.trim());

    fixture.componentInstance.setStatus('unscheduled');
    fixture.detectChanges();
    expect(dayNames()).toEqual(['Bob']);

    fixture.componentInstance.setStatus('working');
    fixture.detectChanges();
    expect(dayNames()).toEqual(['Ada']);

    fixture.componentInstance.setStatus('all');
    fixture.componentInstance.setSearch('bo');
    fixture.detectChanges();
    expect(dayNames()).toEqual(['Bob']);

    (q(doc, 'tsd-mode-week') as HTMLButtonElement).click();
    fixture.detectChanges();
    const weekNames = [...doc.querySelectorAll('[data-testid="tsd-week-row"] .tsd-name')].map((n) => n.textContent!.trim());
    expect(weekNames).toEqual(['Bob']);
  });

  it('csv per mode', async () => {
    const { fixture, doc } = await setup(scheduleResponse([ranked, noPlan]));
    const download = vi.fn();
    fixture.componentInstance.downloadFile = download;

    (q(doc, 'tsd-mode-week') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.exportCsv();

    const [filename, csv] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('team-week-2026-10-26.csv');
    expect(csv.split(/\r?\n/)[0]).toContain('Coverage %');
    expect(csv).toContain('Ada,600,420,300,120,75');
  });

  it('planner off week shows clocked only', async () => {
    const off = weekResponse({
      plannerEnabled: false,
      members: [{ employeeId: 'emp-Bob', displayName: 'Bob', avatarFileId: null, plannedMinutes: 0, clockedMinutes: 240, scheduledMinutes: 0, unscheduledMinutes: 0, coveragePercent: null }],
      totals: { plannedMinutes: 0, clockedMinutes: 240, scheduledMinutes: 0, unscheduledMinutes: 0, coveragePercent: null },
    });
    const { fixture, doc } = await setup(scheduleResponse([noPlan], { plannerEnabled: false }), off);

    (q(doc, 'tsd-mode-week') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(q(doc, 'tsd-week-planner-off')).toBeTruthy();
    expect(q(doc, 'tsd-week-chart')).toBeNull();
    expect(q(doc, 'pa-tile-planned')).toBeNull();
    expect(q(doc, 'tsd-week-clocked')!.textContent!.trim()).toBe('4h');
  });

  it('lists unscheduled work and conflicts with masked titles', async () => {
    const { doc } = await setup(scheduleResponse([ranked, noPlan]));

    expect(q(doc, 'tsd-unscheduled-panel')!.textContent).toContain('Fix bug');
    expect(q(doc, 'tsd-conflicts-panel')!.textContent).toContain('Write report · Private meeting');
    const blockTitles = [...doc.querySelectorAll('[data-testid="tsd-block"]')].map(
      (b) => b.getAttribute('title') ?? '',
    );
    expect(blockTitles.some((t) => t.startsWith('Private meeting'))).toBe(true);
  });

  it('Planner off shows the note', async () => {
    const { doc } = await setup(scheduleResponse([noPlan], { plannerEnabled: false }));
    expect(q(doc, 'tsd-planner-off')).toBeTruthy();
  });

  it('CSV keeps "Private meeting", leaves a missing score empty and names the not-ranked reason', async () => {
    const { fixture } = await setup(scheduleResponse([ranked, onLeave]));
    const download = vi.fn();
    fixture.componentInstance.downloadFile = download;

    fixture.componentInstance.exportCsv();

    const [filename, csv] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('team-schedule-2026-10-29.csv');
    expect(csv).toContain('Private meeting (Finished)');
    const cat = csv.split(/\r?\n/).find((l) => l.startsWith('Cat'))!;
    expect(cat).toContain(',,,,On leave,');
  });
});
