import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { EmployeeInsightsApiService } from '../data-access/employee-insights-api.service';
import { mockOverviewInsights, mockWorkActivityInsights } from '../data-access/employee-insights.mock';
import { EmployeeOverviewInsightsResponse } from '../models/employee-insights.model';
import { EmployeeInsightsStore } from './employee-insights.store';

describe('EmployeeInsightsStore', () => {
  function setup(api: Partial<EmployeeInsightsApiService>) {
    TestBed.configureTestingModule({
      providers: [EmployeeInsightsStore, { provide: EmployeeInsightsApiService, useValue: api }]
    });
    return TestBed.inject(EmployeeInsightsStore);
  }

  it('loads overview insights once per employee and month', async () => {
    const getOverview = vi.fn((_: string, month: string) => of(mockOverviewInsights(month)));
    const store = setup({ getOverview });

    await store.loadOverview('emp-1', '2025-09');
    await store.loadOverview('emp-1', '2025-09');

    expect(getOverview).toHaveBeenCalledTimes(1);
    expect(store.overview()?.attendance.days.length).toBe(30);
    expect(store.overviewLoading()).toBe(false);
  });

  it('ignores a stale overview response after the month changes', async () => {
    const september = new Subject<EmployeeOverviewInsightsResponse | null>();
    const store = setup({
      getOverview: vi.fn((_: string, month: string) => (month === '2025-09' ? september.asObservable() : of(mockOverviewInsights(month))))
    });

    const pending = store.loadOverview('emp-1', '2025-09');
    await store.loadOverview('emp-1', '2025-10');
    september.next(mockOverviewInsights('2025-09'));
    await pending;

    expect(store.overview()?.attendance.days.length).toBe(31);
  });

  it('keeps null when the API has no data (non-development environments)', async () => {
    const store = setup({ getWorkActivity: vi.fn(() => of(null)) });
    await store.loadWorkActivity('emp-1', '2025-09');
    expect(store.workActivity()).toBeNull();
    expect(store.workLoading()).toBe(false);
  });

  it('loads work activity insights', async () => {
    const store = setup({ getWorkActivity: vi.fn((_: string, month: string) => of(mockWorkActivityInsights(month))) });
    await store.loadWorkActivity('emp-1', '2025-09');
    expect(store.workActivity()?.summary.assigned).toBe(24);
  });
});
