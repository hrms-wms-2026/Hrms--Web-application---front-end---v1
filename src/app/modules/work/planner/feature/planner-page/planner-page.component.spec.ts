import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NotificationService } from '../../../../../core/services/notification.service';
import { toOffsetIso } from '../../../meetings/utils/meeting-time';
import { PlannerApiService } from '../../data-access/planner-api.service';
import { PlannerDayResponse } from '../../models/planner.models';
import { PlannerPageComponent } from './planner-page.component';

describe('PlannerPageComponent', () => {
  let fixture: ComponentFixture<PlannerPageComponent>;
  const api = { getMyDay: vi.fn(), createBlock: vi.fn(), moveBlock: vi.fn(), deleteBlock: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const tz = 'Asia/Colombo';

  const day = (over: Partial<PlannerDayResponse> = {}): PlannerDayResponse => ({
    date: '2026-11-02', timezone: tz, editable: true,
    blocks: [{ id: 'b1', taskId: 't1', taskTitle: 'Write the report', startAt: toOffsetIso('2026-11-02', '09:00', tz),
      endAt: toOffsetIso('2026-11-02', '11:00', tz), plannedMinutes: 120, actualMinutes: 45, stillAssigned: true, overlapsMeeting: true }],
    meetings: [{ taskId: 'm1', seriesId: 's1', originalStart: toOffsetIso('2026-11-02', '10:00', tz),
      startAt: toOffsetIso('2026-11-02', '10:00', tz), endAt: toOffsetIso('2026-11-02', '11:00', tz), title: 'Weekly sync',
      isPrivate: false, cancelled: false, declined: false, plannedMinutes: 60, actualMinutes: 0 }],
    dueTasks: [{ taskId: 't2', title: 'Fix the login bug', dueDate: '2026-11-02', estimatedHours: 3 }],
    totals: { plannedMinutes: 180, actualMinutes: 45 },
    attendanceMinutes: 450,
    ...over,
  });

  async function render(response = day()): Promise<void> {
    api.getMyDay.mockReturnValue(of(response));
    fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const all = (id: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];

  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    Object.values(notify).forEach((f) => f.mockReset());
    TestBed.configureTestingModule({
      providers: [{ provide: PlannerApiService, useValue: api }, { provide: NotificationService, useValue: notify }],
    });
    TestBed.overrideComponent(PlannerPageComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } });
  });

  it('renders meetings and blocks on the timeline', async () => {
    await render();

    expect(q('planner-block')?.textContent).toContain('Write the report');
    expect(q('planner-meeting')?.textContent).toContain('Weekly sync');
    expect(q('planner-due-task')?.textContent).toContain('Fix the login bug');
  });

  it('dropping a due task creates a one-hour block at the drop time', async () => {
    await render();
    api.createBlock.mockReturnValue(of(day()));

    await fixture.componentInstance.dropTask('t2', 9 * 60 + 30);

    expect(api.createBlock).toHaveBeenCalledWith({
      taskId: 't2', startAt: toOffsetIso('2026-11-02', '09:30', tz), endAt: toOffsetIso('2026-11-02', '10:30', tz),
    });
  });

  it('shows planned vs actual per row and for the day', async () => {
    await render();

    expect(q('planner-block')?.textContent).toContain('2h 0m planned');
    expect(q('planner-block')?.textContent).toContain('45m actual');
    expect(q('planner-totals')?.textContent).toContain('3h 0m');
    expect(q('planner-totals')?.textContent).toContain('45m');
  });

  it('shows the attendance clock beside planned vs actual', async () => {
    await render();

    expect(q('planner-attendance')?.textContent).toContain('7h 30m');
  });

  it('marks a block that overlaps a meeting', async () => {
    await render();

    expect(q('planner-block-conflict')).not.toBeNull();
  });

  it('past_day_is_read_only', async () => {
    await render(day({ editable: false }));

    expect(all('planner-block-delete')).toHaveLength(0);
    expect(all('planner-block-longer')).toHaveLength(0);
    expect(q('planner-block')?.getAttribute('draggable')).not.toBe('true');
    expect(q('planner-due-task')?.getAttribute('draggable')).not.toBe('true');
  });

  it('overlap error shows the planner_block_overlap copy and keeps the plan as it was', async () => {
    await render();
    api.createBlock.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'planner_block_overlap' } })));

    await fixture.componentInstance.dropTask('t2', 9 * 60);
    fixture.detectChanges();

    expect(notify.error).toHaveBeenCalledWith('This overlaps another planned block.');
    expect(all('planner-block')).toHaveLength(1);
  });

  it('a 503 shows the planner as not available', async () => {
    api.getMyDay.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503, error: { code: 'planner_disabled' } })));
    fixture = TestBed.createComponent(PlannerPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('planner-unavailable')?.textContent).toContain('The planner is not available yet.');
  });

  it('a longer block grows by 15 minutes', async () => {
    await render();
    api.moveBlock.mockReturnValue(of(day()));

    await fixture.componentInstance.resize(day().blocks[0], 15);

    expect(api.moveBlock).toHaveBeenCalledWith('b1', {
      startAt: day().blocks[0].startAt, endAt: toOffsetIso('2026-11-02', '11:15', tz),
    });
  });

  it('moving a block past midnight sends the next day time, never 24:30', async () => {
    // A two-hour block dropped at 22:30 would end at 00:30 the next day. The server then answers "only today" -
    // before, the page built "T24:30", an invalid time that failed with a generic error.
    await render();
    api.moveBlock.mockReturnValue(of(day()));

    await fixture.componentInstance.moveTo(day().blocks[0], 22 * 60 + 30);

    expect(api.moveBlock).toHaveBeenCalledWith('b1', {
      startAt: toOffsetIso('2026-11-02', '22:30', tz), endAt: toOffsetIso('2026-11-03', '00:30', tz),
    });
  });

  it('a block ending at midnight shortens to 23:45, not a negative time', async () => {
    const lateBlock = { ...day().blocks[0], startAt: toOffsetIso('2026-11-02', '23:00', tz), endAt: toOffsetIso('2026-11-03', '00:00', tz) };
    await render(day({ blocks: [lateBlock] }));
    api.moveBlock.mockReturnValue(of(day()));

    await fixture.componentInstance.resize(lateBlock, -15);

    expect(api.moveBlock).toHaveBeenCalledWith('b1', { startAt: lateBlock.startAt, endAt: toOffsetIso('2026-11-02', '23:45', tz) });
  });
});
