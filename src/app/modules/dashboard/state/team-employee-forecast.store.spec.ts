import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamEmployeeForecastApiService } from '../data-access/team-employee-forecast-api.service';
import {
  EmployeeForecastQuery,
  EmployeeForecastResponse,
} from '../models/team-employee-forecast.model';
import { employeeForecastResponse } from '../utils/team-employee-forecast.testing';
import {
  EMPLOYEE_FORECAST_CARD_QUERY,
  TeamEmployeeForecastStore,
} from './team-employee-forecast.store';

describe('TeamEmployeeForecastStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(get = vi.fn((_q: EmployeeForecastQuery) => of(employeeForecastResponse()))) {
    TestBed.configureTestingModule({
      providers: [
        TeamEmployeeForecastStore,
        { provide: TeamEmployeeForecastApiService, useValue: { get } },
      ],
    });
    return { store: TestBed.inject(TeamEmployeeForecastStore), get };
  }

  it('the card loads the top 10 people by overtime', () => {
    const { store, get } = setup();
    store.load();
    expect(get).toHaveBeenCalledWith(EMPLOYEE_FORECAST_CARD_QUERY);
    expect(store.data()?.totals.teamRate).toBe(0.4);
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
    const first = new Subject<EmployeeForecastResponse>();
    const get = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValue(of(employeeForecastResponse({ total: 2 })));
    const { store } = setup(get);
    store.loadTable({ search: 'b' });
    store.loadTable({ search: 'bi' });
    first.next(employeeForecastResponse({ total: 99 }));
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
    store.seed(employeeForecastResponse());
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
