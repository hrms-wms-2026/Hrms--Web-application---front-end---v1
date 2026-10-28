import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamScheduleApiService } from '../../data-access/team-schedule-api.service';
import { TeamScheduleResponse } from '../../models/team-schedule.model';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { at, scheduleMember, scheduleResponse } from '../../utils/team-schedule.testing';
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

  async function setup(data: TeamScheduleResponse) {
    const getTeamDay = vi.fn((date: string | null) => of({ ...data, date: date ?? data.date }));
    await TestBed.configureTestingModule({
      imports: [TeamScheduleDetailDialogComponent],
      providers: [TeamScheduleStore, { provide: TeamScheduleApiService, useValue: { getTeamDay } }],
    }).compileComponents();
    const store = TestBed.inject(TeamScheduleStore);
    store.seed(data);
    const fixture = TestBed.createComponent(TeamScheduleDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return { fixture, store, getTeamDay, doc: fixture.nativeElement.ownerDocument as Document };
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

  it('a missing score is "—", never 0%', async () => {
    const { doc } = await setup(scheduleResponse([onLeave]));
    expect(q(doc, 'tsd-score')!.textContent!.trim()).toBe('—');
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
