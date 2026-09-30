import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExceptionAlertsApiService } from '../data-access/exception-alerts-api.service';
import { ExceptionAlertResponse } from '../models/exception-alert.model';
import { ExceptionAlertsStore } from './exception-alerts.store';

const alert: ExceptionAlertResponse = {
  id: 'a1', employeeId: 'e1', employeeName: 'Kali Raj', type: 'AttendanceIrregularity', status: 'Open',
  title: 'Attendance irregularity', description: 'Worked time dropped.', detectedAt: '2026-09-27T23:30:00Z',
  acknowledgedAt: null, resolvedAt: null, escalatedAt: null, resolutionNote: null
};

describe('ExceptionAlertsStore', () => {
  let api: {
    list: ReturnType<typeof vi.fn>;
    acknowledge: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
    escalate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      list: vi.fn(() => of({ items: [alert], pageNumber: 1, pageSize: 20, totalCount: 1 })),
      acknowledge: vi.fn(() => of(undefined)),
      resolve: vi.fn(() => of(undefined)),
      escalate: vi.fn(() => of(undefined))
    };
    TestBed.configureTestingModule({ providers: [{ provide: ExceptionAlertsApiService, useValue: api }] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads the list and total', async () => {
    const store = TestBed.inject(ExceptionAlertsStore);

    await store.load();

    expect(store.items()).toEqual([alert]);
    expect(store.totalCount()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('applies filters and goes back to page 1', async () => {
    const store = TestBed.inject(ExceptionAlertsStore);
    await store.load(3);

    await store.setFilters('Escalated', 'SustainedLowActivity');

    expect(api.list).toHaveBeenLastCalledWith({ status: 'Escalated', type: 'SustainedLowActivity', page: 1, pageSize: 20 });
    expect(store.page()).toBe(1);
  });

  it('escalates with a trimmed note and reloads the list', async () => {
    const store = TestBed.inject(ExceptionAlertsStore);

    const ok = await store.act('a1', 'escalate', '  needs HR  ');

    expect(ok).toBe(true);
    expect(api.escalate).toHaveBeenCalledWith('a1', 'needs HR');
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.actionLoading()).toBe(false);
  });

  it('keeps the error and still reloads when an action fails (e.g. someone else already resolved it)', async () => {
    api.resolve.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Exception is already resolved.' } })));
    const store = TestBed.inject(ExceptionAlertsStore);

    const ok = await store.act('a1', 'resolve', null);

    expect(ok).toBe(false);
    expect(store.actionError()).toBeTruthy();
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('surfaces a load error', async () => {
    api.list.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const store = TestBed.inject(ExceptionAlertsStore);

    await store.load();

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });
});
