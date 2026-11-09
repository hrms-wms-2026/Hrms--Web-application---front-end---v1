import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamEmployeeForecastApiService } from '../../data-access/team-employee-forecast-api.service';
import { EmployeeForecastQuery } from '../../models/team-employee-forecast.model';
import { TeamEmployeeForecastStore } from '../../state/team-employee-forecast.store';
import {
  EMPLOYEE_FORECAST_ITEMS,
  employeeForecastResponse,
} from '../../utils/team-employee-forecast.testing';
import {
  TeamEmployeeForecastDetailDialogComponent,
  employeeForecastCsv,
} from './team-employee-forecast-detail-dialog.component';

describe('TeamEmployeeForecastDetailDialogComponent', () => {
  let fixture: ComponentFixture<TeamEmployeeForecastDetailDialogComponent>;
  let get: ReturnType<typeof vi.fn<(q: EmployeeForecastQuery) => unknown>>;

  function setup(total = 5): HTMLElement {
    get = vi.fn((q: EmployeeForecastQuery) =>
      of(employeeForecastResponse({ total, page: q.page, pageSize: q.pageSize })),
    );
    TestBed.configureTestingModule({
      imports: [TeamEmployeeForecastDetailDialogComponent],
      providers: [
        TeamEmployeeForecastStore,
        {
          provide: TeamEmployeeForecastApiService,
          useValue: { get: (q: EmployeeForecastQuery) => get(q) },
        },
      ],
    });
    TestBed.inject(TeamEmployeeForecastStore).load();
    fixture = TestBed.createComponent(TeamEmployeeForecastDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return document.body;
  }

  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid=${id}]`);
  const all = (el: HTMLElement, id: string) => el.querySelectorAll(`[data-testid=${id}]`);

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('shows the KPI tiles, the pie, the rate chart and every person', () => {
    const el = setup();
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 25 }));
    expect(q(el, 'efd-tile-remaining')?.textContent?.trim()).toBe('250 h');
    expect(q(el, 'efd-tile-rate')?.textContent?.trim()).toBe('40% / 55%');
    expect(q(el, 'efd-explanation')?.textContent).toContain('completes about 140 h');
    expect(q(el, 'employee-forecast-rate-chart')).toBeTruthy();
    expect(all(el, 'efd-row').length).toBe(5);
    expect(all(el, 'efd-row')[0].textContent).toContain('130%');
    for (const s of ['summary', 'forecast', 'rates', 'employees'])
      expect(el.querySelector(`[data-section=${s}]`)).toBeTruthy();
  });

  it('expanding a person lists the modules they are connected to', () => {
    const el = setup();
    (all(el, 'efd-expand')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const modules = all(el, 'efd-module');
    expect(modules.length).toBe(2);
    expect(modules[0].textContent).toContain('Bob Billing');
    expect(modules[0].textContent).toContain('Atlas');
    expect(modules[0].textContent).toContain('20 Nov');
    expect(modules[0].textContent).toContain('3');
    (all(el, 'efd-expand')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(all(el, 'efd-module').length).toBe(0);
  });

  it('search, status filter, sort and paging go to the server', () => {
    vi.useFakeTimers();
    setup(60);
    const c = fixture.componentInstance;
    c.goToPage(3);
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    c.onSearch('ann');
    vi.advanceTimersByTime(300);
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ann', page: 1 }));
    c.onStatus('raise_rate');
    expect(get).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'raise_rate', search: 'ann' }),
    );
    c.sortBy('rate');
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'rate' }));
    c.goToPage(99);
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  });

  it('exports every person of the filter as CSV', () => {
    setup();
    const download = vi.fn();
    fixture.componentInstance.downloadFile = download;
    fixture.componentInstance.exportCsv();
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 100 }));
    const [name, csv] = download.mock.calls[0] as [string, string];
    expect(name).toBe('employee-overtime-forecast-2026-11-08.csv');
    expect(csv).toContain('Atlas › Ann Billing; Borealis › Ann Search');
  });
});

describe('employeeForecastCsv', () => {
  it('writes rates as percents and blanks for no history or no deadline', () => {
    const rows = employeeForecastCsv([
      ...EMPLOYEE_FORECAST_ITEMS,
      { ...EMPLOYEE_FORECAST_ITEMS[0], deadline: null },
    ]);
    expect(rows[0][3]).toBe('Task rate % (4 wk)');
    expect(rows[1].slice(0, 4)).toEqual(['1', 'Ann', 'Dev', '38.0']);
    expect(rows[1][6]).toBe('130.0');
    expect(rows[5][3]).toBe('');
    expect(rows[6][7]).toBe('');
  });
});
