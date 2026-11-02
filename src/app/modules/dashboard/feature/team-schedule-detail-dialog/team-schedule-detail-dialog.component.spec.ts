import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamScheduleApiService } from '../../data-access/team-schedule-api.service';
import { TeamScheduleResponse, TeamScheduleWeekResponse } from '../../models/team-schedule.model';
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

  it('ranking shows both parts with the score, and "Not ranked · reason" otherwise', async () => {
    const { doc } = await setup(scheduleResponse([ranked, onLeave, noPlan]));

    const rows = [...doc.querySelectorAll('[data-testid="tsd-rank-row"]')].map((r) =>
      r.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(rows[0]).toContain('Items 50% · Time 100%');
    expect(rows[0]).toContain('70%');
    expect(rows[1]).toContain('Not ranked · On leave');
    expect(rows[2]).toContain('No plan');
    expect(rows[2]).toContain('Not ranked · Nothing due yet');
    expect(rows[2]).toContain('Unscheduled 2h');
  });

  it('a missing completion is "—" or "No plan", never 0%', async () => {
    const { doc } = await setup(scheduleResponse([onLeave, { ...ranked, itemCompletionPercent: null }]));
    const completion = [...doc.querySelectorAll('[data-testid="tsd-completion"]')].map((c) => c.textContent!.trim());
    expect(completion).toEqual(['No plan', '—']);
  });

  it('day tiles: Total items, Completed, In progress, Pending and Meetings with %', async () => {
    const data = scheduleResponse([ranked], {
      summary: { ...scheduleResponse([]).summary, people: 1, tasksPlanned: 2, tasksCompleted: 1, tasksInProgress: 1, tasksPending: 0, meetings: 2 },
    });
    const { doc } = await setup(data);

    expect(q(doc, 'tsd-tile-total')!.textContent!.trim()).toBe('4');
    const completed = q(doc, 'tsd-tile-completed')!.closest('[data-testid="kpi-tile"]')!.textContent!;
    expect(completed).toContain('25%');
  });

  it('day table: workload level, planned and actual, side column with top workload', async () => {
    const busy = { ...ranked, plannedTaskMinutes: 420, plannedMeetingMinutes: 60, expectedMinutes: 480, scheduledMinutes: 200, noPlanMinutes: 30 };
    const { doc } = await setup(scheduleResponse([busy, noPlan]));

    expect(q(doc, 'tsd-workload')!.textContent!.trim()).toBe('High');
    expect(q(doc, 'tsd-actual')!.textContent!.trim()).toBe('3h 50m');
    expect(q(doc, 'tsd-top-workload')!.textContent).toContain('Ada');
    expect(q(doc, 'tsd-day-chart')).toBeTruthy();
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

    expect(q(doc, 'tsd-unscheduled-panel')!.textContent).toContain(
      'Worked without a matching Planner slot.',
    );
    expect(q(doc, 'tsd-unscheduled-panel')!.textContent).toContain('Fix bug');
    expect(q(doc, 'tsd-conflicts-panel')!.textContent).toContain('Write report / Private meeting');
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
