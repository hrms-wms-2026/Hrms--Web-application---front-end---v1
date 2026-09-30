import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeeDetailResponse } from '../../../models/employee.model';
import { PositionHistoryEntryResponse } from '../../../models/position-history.model';
import { EmployeeInsightsApiService } from '../../../data-access/employee-insights-api.service';
import { mockOverviewInsights } from '../../../data-access/employee-insights.mock';
import { EmployeeOverviewTabComponent } from './employee-overview-tab.component';
import { detailFixture, setupTabTestBed } from './employee-detail-tab.testing';

describe('EmployeeOverviewTabComponent', () => {
  async function render(employee: EmployeeDetailResponse, options: { jobJourney?: readonly PositionHistoryEntryResponse[] } = {}) {
    await setupTabTestBed(
      employee.id,
      { getEmployeeDetail: vi.fn().mockReturnValue(of(employee)), getJobJourney: vi.fn().mockReturnValue(of(options.jobJourney ?? [])) },
      { success: vi.fn(), error: vi.fn() }
    );
    const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the Employment & Organization card from the detail response', async () => {
    const fixture = await render(detailFixture);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Employment & Organization');
    expect(text).toContain('Software Engineer');
    expect(text).toContain('Grace Hopper');
    expect(fixture.nativeElement.querySelector('[data-testid="overview-tenure"]').textContent.trim()).not.toBe('—');
  });

  it('lists the most recent history entries first', async () => {
    const entry = (effectiveFrom: string, positionName: string) => ({
      positionName, departmentName: null, effectiveFrom, effectiveTo: null,
      changeReason: null, initiatedByName: 'HR', approvedByName: null
    });
    const fixture = await render(detailFixture, {
      jobJourney: [entry('2024-01-15', 'Junior Engineer'), entry('2025-06-01', 'Software Engineer')]
    });

    const entries = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="timeline-item"]')) as HTMLElement[];
    expect(entries.map((e) => e.textContent)).toEqual([
      expect.stringMatching(/Jun 1, 2025.*Position changed.*Junior Engineer → Software Engineer/),
      expect.stringMatching(/Jan 15, 2024.*Joined company.*Joined as Junior Engineer/)
    ]);
  });

  it('omits the Attendance today card when the response has no attendance summary (caller lacks attendance:read)', async () => {
    const fixture = await render({ ...detailFixture, attendanceSummary: null });

    expect(fixture.nativeElement.textContent).not.toContain('Attendance today');
  });

  it('shows the not-clocked-in warning in the Attendance today card', async () => {
    const fixture = await render({
      ...detailFixture,
      attendanceSummary: {
        showNotClockedInWarning: true,
        shouldHaveClockedIn: true,
        hasClockedInToday: false,
        workDate: '2026-08-15',
        timezone: 'UTC',
        scheduledStartTime: '09:00',
        warningLabel: 'Still has not clocked in',
        attendanceStatus: 'not_clocked_in',
        attendanceStatusLabel: 'Not clocked in',
        attentionType: 'not_clocked_in',
        attentionSeverity: 'critical',
        attentionLabel: 'Still has not clocked in'
      }
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Attendance today');
    expect(text).toContain('Still has not clocked in');
  });

  it('shows the status label and break-overage marker in the Attendance today card', async () => {
    const fixture = await render({
      ...detailFixture,
      attendanceSummary: {
        showNotClockedInWarning: false,
        shouldHaveClockedIn: true,
        hasClockedInToday: true,
        workDate: '2026-08-15',
        timezone: 'UTC',
        scheduledStartTime: '09:00',
        warningLabel: null,
        attendanceStatus: 'on_break',
        attendanceStatusLabel: 'On break',
        attentionType: null,
        attentionSeverity: null,
        attentionLabel: null,
        breakUsedMinutes: 75,
        breakAllowanceMinutes: 60,
        breakOverageMinutes: 15,
        isOverBreakAllowance: true
      }
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('On break');
    expect(text).toContain('Break exceeded by 15 min');
  });

  describe('period insights', () => {
    async function renderWithInsights(overview: ReturnType<typeof mockOverviewInsights> | null) {
      await setupTabTestBed(
        detailFixture.id,
        { getEmployeeDetail: vi.fn().mockReturnValue(of(detailFixture)), getJobJourney: vi.fn().mockReturnValue(of([])) },
        { success: vi.fn(), error: vi.fn() },
        [{ provide: EmployeeInsightsApiService, useValue: { getOverview: vi.fn(() => of(overview)), getWorkActivity: vi.fn(() => of(null)) } }]
      );
      const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      // The insights effect resolves through a promise the zone does not track; let it settle.
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('renders the attendance, work, time off, approvals, productivity and checklist cards', async () => {
      const root = await renderWithInsights(mockOverviewInsights('2025-09'));
      const text = root.textContent ?? '';

      for (const heading of ['Attendance', 'Work Management', 'Time Off', 'Approval Activity', 'Recent Activity', 'Productivity & Work Insights', 'Upcoming Items', 'Checklists']) {
        expect(text).toContain(heading);
      }
      expect(text).toContain('Missing clock-out');
      expect(text).toContain('12 days');
      expect(text).toContain('Sep 23 – 25');
      expect(text).toContain('Work insight index');
      expect(text).toContain('6 / 8');
      expect(root.querySelectorAll('.chart__bar').length).toBe(30);
    });

    it('shows "No data yet" instead of numbers when insights are unavailable, keeping the real cards', async () => {
      const root = await renderWithInsights(null);

      expect(root.querySelectorAll('[data-testid="empty-note"]').length).toBe(8);
      expect(root.textContent).toContain('Employment & Organization');
      expect(root.textContent).not.toContain('Work insight index');
    });
  });
});
