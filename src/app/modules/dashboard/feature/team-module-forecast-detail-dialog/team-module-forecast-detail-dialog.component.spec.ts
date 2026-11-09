import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamModuleForecastApiService } from '../../data-access/team-module-forecast-api.service';
import { ModuleForecastQuery } from '../../models/team-module-forecast.model';
import { TeamModuleForecastStore } from '../../state/team-module-forecast.store';
import {
  MODULE_FORECAST_ITEMS,
  moduleForecastResponse,
} from '../../utils/team-module-forecast.testing';
import {
  TeamModuleForecastDetailDialogComponent,
  moduleForecastCsv,
} from './team-module-forecast-detail-dialog.component';

describe('TeamModuleForecastDetailDialogComponent', () => {
  let fixture: ComponentFixture<TeamModuleForecastDetailDialogComponent>;
  let get: ReturnType<typeof vi.fn<(q: ModuleForecastQuery) => unknown>>;

  function setup(total = 5): HTMLElement {
    get = vi.fn((q: ModuleForecastQuery) =>
      of(moduleForecastResponse({ total, page: q.page, pageSize: q.pageSize })),
    );
    TestBed.configureTestingModule({
      imports: [TeamModuleForecastDetailDialogComponent],
      providers: [
        TeamModuleForecastStore,
        {
          provide: TeamModuleForecastApiService,
          useValue: { get: (q: ModuleForecastQuery) => get(q) },
        },
      ],
    });
    TestBed.inject(TeamModuleForecastStore).load();
    fixture = TestBed.createComponent(TeamModuleForecastDetailDialogComponent);
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

  it('opening loads the first table page of 25', () => {
    setup();
    expect(get).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25, sort: 'overtime' }),
    );
  });

  it('shows the KPI tiles, the pie with its explanation, the project chart and every module', () => {
    const el = setup();
    expect(q(el, 'mfd-tile-allocated')?.textContent?.trim()).toBe('2,400 h');
    expect(q(el, 'mfd-tile-rate')?.textContent?.trim()).toBe('42% / 58%');
    expect(q(el, 'mfd-tile-overtime')?.textContent?.trim()).toBe('950 h');
    expect(q(el, 'mfd-explanation')?.textContent).toContain('completes about 1,100 h');
    expect(q(el, 'module-forecast-project-chart')).toBeTruthy();
    expect(all(el, 'mfd-row').length).toBe(5);
    expect(all(el, 'mfd-status')[0].textContent?.trim()).toBe('Overtime');
    for (const s of ['summary', 'forecast', 'projects', 'modules'])
      expect(el.querySelector(`[data-section=${s}]`)).toBeTruthy();
  });

  it('expanding a module lists its team members', () => {
    const el = setup();
    expect(all(el, 'mfd-members').length).toBe(0);
    (all(el, 'mfd-expand')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    const members = all(el, 'mfd-member');
    expect(members.length).toBe(2);
    expect(members[0].textContent).toContain('Billing Ann');
    expect(members[0].textContent).toContain('50%');
    expect(members[0].textContent).toContain('80 h');
    expect(all(el, 'mfd-expand')[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('the status filter, sort and search go to the server and back to page 1', () => {
    vi.useFakeTimers();
    setup(60);
    const c = fixture.componentInstance;
    c.goToPage(2);
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    c.onStatus('overtime');
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'overtime', page: 1 }));
    c.sortBy('endDate');
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'endDate' }));
    c.onSearch(' bill');
    c.onSearch(' billing ');
    vi.advanceTimersByTime(300);
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'billing' }));
    expect(get.mock.calls.filter(([x]) => x.search === 'bill').length).toBe(0);
    c.onStatus('all');
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ status: null }));
  });

  it('pages through a long list', () => {
    const el = setup(60);
    expect(q(el, 'mfd-pager')?.textContent).toContain('Page 1 of 3');
    (q(el, 'mfd-next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(q(el, 'mfd-pager')?.textContent).toContain('Page 2 of 3');
    expect(all(el, 'mfd-row')[0].textContent).toContain('26');
  });

  it('exports every module of the filter as CSV', () => {
    setup();
    const download = vi.fn();
    fixture.componentInstance.downloadFile = download;
    fixture.componentInstance.exportCsv();
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 100 }));
    const [name, csv] = download.mock.calls[0] as [string, string];
    expect(name).toBe('module-overtime-forecast-2026-11-08.csv');
    expect(csv.split('\n')[0]).toContain('Required rate %');
    expect(csv).toContain('Billing Ann; Billing Bob');
  });
});

describe('moduleForecastCsv', () => {
  it('writes hours with one decimal and rates as percents, blank without history', () => {
    const rows = moduleForecastCsv(MODULE_FORECAST_ITEMS);
    expect(rows[1].slice(0, 4)).toEqual(['1', 'Billing', 'Atlas › Billing', 'Borealis']);
    expect(rows[1][9]).toBe('42.0');
    expect(rows[5][9]).toBe('');
    expect(rows[1][12]).toBe('Overtime');
  });
});
