import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlannerApiService } from '../../../../work/planner/data-access/planner-api.service';
import { PlannerDayResponse } from '../../../../work/planner/models/planner.models';
import { TodaysPlanTabComponent } from './todays-plan-tab.component';

describe('TodaysPlanTabComponent', () => {
  let fixture: ComponentFixture<TodaysPlanTabComponent>;
  const api = { getEmployeeDay: vi.fn() };
  const availability: boolean[] = [];

  const day = (): PlannerDayResponse => ({
    date: '2026-11-02', timezone: 'UTC', editable: false,
    blocks: [{ id: 'b1', taskId: 't1', taskTitle: 'Write the report', startAt: '2026-11-02T09:00:00Z', endAt: '2026-11-02T10:00:00Z',
      plannedMinutes: 60, actualMinutes: 30, stillAssigned: true, overlapsMeeting: false }],
    meetings: [{ taskId: 'm1', seriesId: 's1', originalStart: '2026-11-02T15:00:00Z', startAt: '2026-11-02T15:00:00Z',
      endAt: '2026-11-02T15:30:00Z', title: 'Private meeting', isPrivate: true, cancelled: false, declined: false,
      plannedMinutes: 30, actualMinutes: 0 }],
    dueTasks: [], totals: { plannedMinutes: 90, actualMinutes: 30 },
  });

  async function render(employeeId: string): Promise<void> {
    fixture.componentRef.setInput('employeeId', employeeId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    api.getEmployeeDay.mockReset();
    availability.length = 0;
    TestBed.configureTestingModule({ providers: [{ provide: PlannerApiService, useValue: api }] });
    fixture = TestBed.createComponent(TodaysPlanTabComponent);
    fixture.componentInstance.availability.subscribe((a: boolean) => availability.push(a));
  });

  it('shows the tab only when the day loads', async () => {
    api.getEmployeeDay.mockReturnValue(of(day()));
    await render('e1');
    expect(availability.at(-1)).toBe(true);

    api.getEmployeeDay.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture = TestBed.createComponent(TodaysPlanTabComponent);
    fixture.componentInstance.availability.subscribe((a: boolean) => availability.push(a));
    await render('e2');
    expect(availability.at(-1)).toBe(false);
  });

  it('is read-only and masks private meetings', async () => {
    api.getEmployeeDay.mockReturnValue(of(day()));
    await render('e1');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Write the report');
    expect(text).toContain('Private meeting');
    expect(text).toContain('1h 30m');
    expect(fixture.nativeElement.querySelectorAll('button:not([data-testid^="plan-"])').length).toBe(0);
    expect(api.getEmployeeDay).toHaveBeenCalledWith('e1', null);
  });

  it('a manager can go back to earlier days, and back to today', async () => {
    api.getEmployeeDay.mockReturnValue(of(day()));
    await render('e1');

    (fixture.nativeElement.querySelector('[data-testid="plan-previous-day"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.getEmployeeDay).toHaveBeenLastCalledWith('e1', '2026-11-01');

    (fixture.nativeElement.querySelector('[data-testid="plan-today"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(api.getEmployeeDay).toHaveBeenLastCalledWith('e1', null);
  });

  it('resets when navigating to another employee', async () => {
    api.getEmployeeDay.mockReturnValueOnce(of(day()))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    await render('e1');
    await render('e2');

    expect(api.getEmployeeDay).toHaveBeenLastCalledWith('e2', null);
    expect(availability.at(-1)).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Write the report');
  });
});
