import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamWorkTaskApiService } from '../../data-access/team-work-task-api.service';
import { TeamWorkTaskHoursResponse, TeamWorkTaskQuery } from '../../models/team-work-task.model';
import { TeamWorkTaskStore } from '../../state/team-work-task.store';
import { WORK_TASK_ROWS, workTaskResponse, workTaskRow } from '../../utils/team-work-task.testing';
import {
  TeamWorkTaskDetailDialogComponent,
  gapMinutes,
  sortWorkTaskRows,
} from './team-work-task-detail-dialog.component';

describe('TeamWorkTaskDetailDialogComponent', () => {
  let fixture: ComponentFixture<TeamWorkTaskDetailDialogComponent>;
  let get: ReturnType<typeof vi.fn<(q: TeamWorkTaskQuery) => unknown>>;

  function setup(data: TeamWorkTaskHoursResponse = workTaskResponse()): HTMLElement {
    get = vi.fn((_q: TeamWorkTaskQuery) => of(data));
    TestBed.configureTestingModule({
      imports: [TeamWorkTaskDetailDialogComponent],
      providers: [
        TeamWorkTaskStore,
        { provide: TeamWorkTaskApiService, useValue: { get: (q: TeamWorkTaskQuery) => get(q) } },
      ],
    });
    TestBed.inject(TeamWorkTaskStore).load();
    fixture = TestBed.createComponent(TeamWorkTaskDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return document.body;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid=${id}]`);

  afterEach(() => TestBed.resetTestingModule());

  it('shows five KPI tiles, the chart, the pie with its explanation and every member', () => {
    const el = setup();
    expect(q(el, 'wtd-tile-worked')?.textContent?.trim()).toBe('120h');
    expect(q(el, 'wtd-tile-task')?.textContent?.trim()).toBe('60h');
    expect(q(el, 'wtd-tile-utilization')?.textContent?.trim()).toBe('50%');
    expect(q(el, 'wtd-tile-completed')?.textContent?.trim()).toBe('12');
    expect(q(el, 'work-task-chart')).toBeTruthy();
    expect(q(el, 'wtd-explanation')?.textContent).toContain(
      'Of 120h worked, 60h is covered by completed tasks',
    );
    expect(el.querySelectorAll('[data-testid=wtd-row]').length).toBe(10);
  });

  it('search narrows the table', () => {
    const el = setup();
    fixture.componentInstance.onSearch('bo');
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid=wtd-row]').length).toBe(1);
  });

  it('sorting a column starts high-to-low and flips on a second click', () => {
    setup();
    const c = fixture.componentInstance;
    c.sortBy('worked');
    expect(c['sortDesc']()).toBe(true);
    c.sortBy('worked');
    expect(c['sortDesc']()).toBe(false);
    c.sortBy('name');
    expect(c['sortDesc']()).toBe(false);
  });

  it('exports the shown rows as CSV', () => {
    setup();
    const download = vi.fn();
    fixture.componentInstance.downloadFile = download;
    fixture.componentInstance.exportCsv();
    const [name, csv] = download.mock.calls[0] as [string, string];
    expect(name).toBe('work-vs-task-2026-10-26_2026-11-01.csv');
    expect(csv.split('\n')[0]).toContain('Task share %');
    expect(csv).toContain('Ann');
  });

  it('the period select and arrows move the store', () => {
    setup();
    fixture.componentInstance.onPeriodSelect('day');
    expect(get).toHaveBeenLastCalledWith({ period: 'day', anchor: '2026-10-28' });
    fixture.componentInstance.shift(-1);
    expect(get).toHaveBeenLastCalledWith({ period: 'day', anchor: '2026-10-27' });
  });

  it('explains when completed estimates pass the time worked', () => {
    const el = setup(
      workTaskResponse({
        totals: {
          workedMinutes: 60,
          breakMinutes: 0,
          taskMinutes: 180,
          completedTasks: 1,
          unestimatedTasks: 0,
          utilization: 300,
        },
      }),
    );
    expect(q(el, 'wtd-explanation')?.textContent).toContain('2h more than the time worked');
  });
});

describe('sortWorkTaskRows', () => {
  it('puts unranked people last by rank and breaks ties by name', () => {
    const rows = [workTaskRow('Zed', null, null), ...WORK_TASK_ROWS.slice(0, 2)];
    expect(sortWorkTaskRows(rows, 'rank', false).map((r) => r.name)).toEqual(['Ann', 'Bob', 'Zed']);
    expect(sortWorkTaskRows(rows, 'name', false).map((r) => r.name)).toEqual(['Ann', 'Bob', 'Zed']);
    expect(sortWorkTaskRows(rows, 'task', true).map((r) => r.name)).toEqual(['Ann', 'Bob', 'Zed']);
  });

  it('gap is worked minus task time', () => {
    expect(gapMinutes({ workedMinutes: 480, taskMinutes: 300 })).toBe(180);
  });
});
