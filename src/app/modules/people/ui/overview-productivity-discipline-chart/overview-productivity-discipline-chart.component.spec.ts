import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewProductivityDisciplineChartComponent } from './overview-productivity-discipline-chart.component';

describe('OverviewProductivityDisciplineChartComponent', () => {
  function setup(days: readonly { date: string; status: string }[] = [], noTasks = false) {
    const api = {
      getOverviewAttendance: vi.fn().mockReturnValue(
        of({
          from: '2026-09-01',
          to: '2026-09-30',
          workingDays: 20,
          present: 19,
          late: 1,
          missingClockOuts: 0,
          leaveDays: 1,
          days
        })
      ),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(
        of({
          from: '2026-09-01',
          to: '2026-09-30',
          lateClockIns: 1,
          earlyClockOuts: 0,
          missingClockOuts: 0,
          overBreakDays: 0,
          overBreakMinutes: 0,
          locationTrackingEnabled: false,
          locationViolations: null
        })
      ),
      getOverviewWork: vi.fn().mockReturnValue(
        of({
          from: '2026-09-01',
          to: '2026-09-30',
          assigned: noTasks ? 0 : 10,
          completed: noTasks ? 0 : 8,
          inProgress: noTasks ? 0 : 2,
          overdue: 0,
          notStarted: 0,
          completionRatePercent: noTasks ? 0 : 80,
          onTimeRatePercent: noTasks ? null : 85
        })
      ),
      getOverviewDelivery: vi.fn().mockReturnValue(
        of({
          from: '2026-09-01',
          to: '2026-09-30',
          tasksAssigned: noTasks ? 0 : 10,
          tasksCompleted: noTasks ? 0 : 8,
          onTimeCompleted: noTasks ? 0 : 7,
          completedWithDueDate: noTasks ? 0 : 8,
          storyPointsAssigned: 20,
          storyPointsCompleted: 16,
          previous: null
        })
      )
    };

    TestBed.configureTestingModule({
      imports: [OverviewProductivityDisciplineChartComponent],
      providers: [
        EmployeePeriodStore,
        { provide: PeopleApiService, useValue: api }
      ]
    });

    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewProductivityDisciplineChartComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();

    return { fixture, api, store, el: fixture.nativeElement as HTMLElement };
  }

  it('renders title, radial scores and correlation insight', () => {
    const { el } = setup();

    expect(el.textContent).toContain('Productivity & Attendance Discipline');
    expect(el.querySelector('[data-testid="discipline-score"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="productivity-score"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="correlation-insight"]')).toBeTruthy();
  });

  it('keeps the percentage grid inside the bar plot and the week labels outside it', () => {
    const { el } = setup();
    const plot = el.querySelector('[data-testid="weekly-chart-plot"]')!;

    expect(plot.querySelector('[data-testid="chart-grid-100"]')).toBeTruthy();
    expect(plot.querySelector('[data-testid="chart-grid-0"]')).toBeTruthy();
    expect(plot.querySelector('[data-testid="chart-x-labels"]')).toBeNull();
    expect(el.querySelector('[data-testid="chart-x-labels"]')).toBeTruthy();
  });

  it('calls all required APIs to construct correlation', () => {
    const { api } = setup();

    expect(api.getOverviewAttendance).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
    expect(api.getOverviewWork).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewDelivery).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
  });

  it('plots a gap for a week containing only pre-hire days', () => {
    const days = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-09-0${index + 1}`,
      status: 'none'
    }));
    const { fixture } = setup(days);

    expect(fixture.componentInstance.data()?.weeklyGroups[0].disciplinePercent).toBeNull();
  });

  it('renders the picked compare month as a dashed second trend series', () => {
    const { fixture, api, store, el } = setup();

    store.setCompareMonth('2026-08');
    fixture.detectChanges();

    const compare = el.querySelector('[data-testid="trend-compare"]')!;
    expect(compare).toBeTruthy();
    expect(compare.getAttribute('stroke-dasharray')).toBe('4 4');
    expect(el.textContent).toContain('Aug 2026');
    expect(api.getOverviewAttendance).toHaveBeenCalledWith('emp-1', '2026-08-01', '2026-08-31');
    expect(api.getOverviewWork).toHaveBeenCalledWith('emp-1', '2026-08-01', '2026-08-31');
  });

  it('draws no delivery bar (never 100%) for a month with no tasks, and says so', () => {
    const { el } = setup([], true);

    const blueBars = el.querySelectorAll('.bg-blue-600.rounded-t-sm');
    expect(blueBars).toHaveLength(0);
    expect(el.querySelectorAll('[data-testid="productivity-no-tasks"]')).toHaveLength(4);
    expect(el.querySelector('[data-testid="productivity-no-tasks-note"]')?.textContent).toContain('No tasks this period');
    expect(el.querySelector('[data-testid="productivity-score"]')?.textContent).toBe('n/a');
    expect(el.querySelector('[data-testid="correlation-insight"]')?.textContent).toContain('no tasks in this period');
  });

  it('still draws the delivery bars when there are tasks', () => {
    const { el } = setup();
    expect(el.querySelectorAll('[data-testid="productivity-no-tasks"]')).toHaveLength(0);
    expect(el.querySelector('[data-testid="productivity-no-tasks-note"]')).toBeNull();
    expect(el.querySelectorAll('.bg-blue-600.rounded-t-sm')).toHaveLength(4);
  });
});
