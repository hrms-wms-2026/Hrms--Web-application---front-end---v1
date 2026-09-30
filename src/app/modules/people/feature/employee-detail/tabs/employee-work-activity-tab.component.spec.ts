import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeeInsightsApiService } from '../../../data-access/employee-insights-api.service';
import { mockWorkActivityInsights } from '../../../data-access/employee-insights.mock';
import { EmployeeWorkActivityTabComponent } from './employee-work-activity-tab.component';
import { detailFixture, setupTabTestBed } from './employee-detail-tab.testing';

describe('EmployeeWorkActivityTabComponent', () => {
  async function render(workActivity: ReturnType<typeof mockWorkActivityInsights> | null) {
    const getWorkActivity = vi.fn(() => of(workActivity));
    await setupTabTestBed(
      detailFixture.id,
      { getEmployeeDetail: vi.fn().mockReturnValue(of(detailFixture)), getJobJourney: vi.fn().mockReturnValue(of([])) },
      { success: vi.fn(), error: vi.fn() },
      [{ provide: EmployeeInsightsApiService, useValue: { getWorkActivity, getOverview: vi.fn(() => of(null)) } }]
    );
    const fixture = TestBed.createComponent(EmployeeWorkActivityTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // The insights effect resolves through a promise the zone does not track; let it settle.
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, getWorkActivity };
  }

  it('loads insights for the store employee and period and renders every section', async () => {
    const { root, getWorkActivity } = await render(mockWorkActivityInsights('2025-09'));

    expect(getWorkActivity).toHaveBeenCalledWith('emp-1', expect.stringMatching(/^\d{4}-\d{2}$/));
    const text = root.textContent ?? '';
    for (const heading of ['Work Summary', 'Needs Attention', 'Delivery Health', 'Recorded Activity', 'Recent Tasks', 'Application Usage', 'Work Pattern']) {
      expect(text).toContain(heading);
    }
    expect(text).toContain('34 / 42');
    expect(text).toContain('1d 19h overdue');
    expect(text).toContain('2h 30m');
    expect(text).toContain('VS Code');
  });

  it('shows "No data yet" in each card when there are no insights', async () => {
    const { root, getWorkActivity } = await render(null);

    // Regression: a null result must not re-trigger the load effect in a loop.
    expect(getWorkActivity).toHaveBeenCalledTimes(1);

    expect(root.querySelectorAll('[data-testid="empty-note"]').length).toBe(7);
    expect(root.textContent).not.toContain('1d 19h overdue');
  });
});
