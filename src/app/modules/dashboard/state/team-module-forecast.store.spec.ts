import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamModuleForecastApiService } from '../data-access/team-module-forecast-api.service';
import { ModuleForecastQuery, ModuleForecastResponse } from '../models/team-module-forecast.model';
import { moduleForecastItem, moduleForecastResponse } from '../utils/team-module-forecast.testing';
import { fetchAllForecastPages, nextTableQuery } from './overtime-forecast-store.util';
import { MODULE_FORECAST_CARD_QUERY, TeamModuleForecastStore } from './team-module-forecast.store';

describe('TeamModuleForecastStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(get = vi.fn((_q: ModuleForecastQuery) => of(moduleForecastResponse()))) {
    TestBed.configureTestingModule({
      providers: [
        TeamModuleForecastStore,
        { provide: TeamModuleForecastApiService, useValue: { get } },
      ],
    });
    return { store: TestBed.inject(TeamModuleForecastStore), get };
  }

  it('the card loads the top 10 by overtime', () => {
    const { store, get } = setup();
    store.load();
    expect(get).toHaveBeenCalledWith(MODULE_FORECAST_CARD_QUERY);
    expect(store.data()?.totals.teamRate).toBe(0.42);
    expect(store.loadedAt()).not.toBeNull();
  });

  it('the table pages 25 and a filter change goes back to page 1', () => {
    const { store, get } = setup();
    store.loadTable({ page: 3 });
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, pageSize: 25 }));
    store.loadTable({ status: 'overtime' });
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'overtime', page: 1 }));
    expect(store.table()?.total).toBe(5);
  });

  it('only the latest table request lands', () => {
    const first = new Subject<ModuleForecastResponse>();
    const get = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValue(of(moduleForecastResponse({ total: 2 })));
    const { store } = setup(get);
    store.loadTable({ search: 'b' });
    store.loadTable({ search: 'bi' });
    first.next(moduleForecastResponse({ total: 99 }));
    expect(store.table()?.total).toBe(2);
    expect(first.observed).toBe(false);
  });

  it('keeps the error message', () => {
    const { store } = setup(vi.fn(() => throwError(() => ({ error: { detail: 'nope' } }))));
    store.load();
    expect(store.error()).toBe('nope');
    store.loadTable();
    expect(store.tableError()).toBe('nope');
    expect(store.loading()).toBe(false);
  });

  it('a seed applies the bootstrap payload without a request', () => {
    const { store, get } = setup();
    store.seed(moduleForecastResponse());
    expect(get).not.toHaveBeenCalled();
    expect(store.data()?.items.length).toBe(5);
  });

  it('the CSV export asks for every row of the current filter', () => {
    const { store, get } = setup();
    store.loadTable({ status: 'raise_rate', page: 2 });
    store.fetchAll().subscribe();
    expect(get).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'raise_rate', page: 1, pageSize: 100 }),
    );
  });
});

describe('fetchAllForecastPages', () => {
  it('reads every page of 100 and joins the items in order', () => {
    const get = vi.fn((q: ModuleForecastQuery) =>
      of(
        moduleForecastResponse({
          total: 250,
          page: q.page,
          items: [moduleForecastItem(`p${q.page}`, 'overtime', 1)],
        }),
      ),
    );
    let rows: string[] = [];
    fetchAllForecastPages(get, { ...MODULE_FORECAST_CARD_QUERY, page: 3 }).subscribe(
      (r) => (rows = r.items.map((m) => m.title)),
    );
    expect(get.mock.calls.map(([q]) => [q.page, q.pageSize])).toEqual([
      [1, 100],
      [2, 100],
      [3, 100],
    ]);
    expect(rows).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('nextTableQuery', () => {
  it('keeps the page for a page-only patch and an unchanged filter', () => {
    const q = { ...MODULE_FORECAST_CARD_QUERY, page: 4 };
    expect(nextTableQuery(q, { page: 2 }).page).toBe(2);
    expect(nextTableQuery(q, { sort: 'overtime' }).page).toBe(4);
    expect(nextTableQuery(q, { sort: 'name' }).page).toBe(1);
  });
});
