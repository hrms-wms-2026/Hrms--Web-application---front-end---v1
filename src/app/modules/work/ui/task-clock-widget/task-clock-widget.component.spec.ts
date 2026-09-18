import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { TaskClockWidgetComponent } from './task-clock-widget.component';
import { WorkTask } from '../../models/task.model';
import { environment } from '../../../../../environments/environment';

const baseTask: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 'st1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null, assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
  attachments: []
};

describe('TaskClockWidgetComponent', () => {
  let fixture: ComponentFixture<TaskClockWidgetComponent>;
  let httpMock: HttpTestingController;

  afterEach(() => httpMock.verify());

  function setup(overrides: Partial<{ task: WorkTask; hasOpenSessionMine: boolean; hasOpenSessionOtherEmployee: boolean; isAssignee: boolean }> = {}): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskClockWidgetComponent, HttpClientTestingModule] });
    fixture = TestBed.createComponent(TaskClockWidgetComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('task', overrides.task ?? baseTask);
    fixture.componentRef.setInput('hasOpenSessionMine', overrides.hasOpenSessionMine ?? false);
    fixture.componentRef.setInput('hasOpenSessionOtherEmployee', overrides.hasOpenSessionOtherEmployee ?? false);
    fixture.componentRef.setInput('isAssignee', overrides.isAssignee ?? true);
    fixture.detectChanges();
  }

  it('shows an enabled Clock In button when the caller is an assignee with no open session and the task is not locked', () => {
    setup();
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('disables Clock In when the task is locked at 100%', () => {
    setup({ task: { ...baseTask, progressPercent: 100 } });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('complete');
  });

  it('disables Clock In when someone else has an open session on this task', () => {
    setup({ hasOpenSessionOtherEmployee: true });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('in progress');
  });

  it('disables Clock In when the caller is not an assignee', () => {
    setup({ isAssignee: false });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('assignee');
  });

  it('shows a Pause button instead of Clock In when the caller has an open session', () => {
    setup({ hasOpenSessionMine: true });
    expect(fixture.nativeElement.querySelector('[data-testid="clock-in-button"]')).toBeNull();
    const pauseBtn = fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement;
    expect(pauseBtn).toBeTruthy();
    expect(pauseBtn.textContent).toContain('Pause');
  });

  it('shows a live-ticking timer while clocked in, and it advances every second', () => {
    vi.useFakeTimers();
    try {
      const clockInAt = new Date('2026-08-26T10:00:00Z');
      vi.setSystemTime(new Date('2026-08-26T10:01:05Z'));
      setup({ hasOpenSessionMine: true, task: { ...baseTask, openClockSessionClockInAt: clockInAt } });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="clock-timer"]').textContent.trim()).toBe('01:05');

      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="clock-timer"]').textContent.trim()).toBe('01:06');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the timer frozen at the persisted total when not currently clocked in', () => {
    setup({ hasOpenSessionMine: false, task: { ...baseTask, totalLoggedMinutes: 95 } });
    // 95 min = 1h 35m
    expect(fixture.nativeElement.querySelector('[data-testid="clock-timer"]').textContent.trim()).toBe('01:35:00');
  });

  it('shows the timer frozen at 0 when never clocked in before', () => {
    setup({ hasOpenSessionMine: false });
    expect(fixture.nativeElement.querySelector('[data-testid="clock-timer"]').textContent.trim()).toBe('00:00');
  });

  it('resumes the timer from the persisted total on a new Clock In, not from 0', () => {
    vi.useFakeTimers();
    try {
      const clockInAt = new Date('2026-08-26T10:00:00Z');
      vi.setSystemTime(new Date('2026-08-26T10:00:10Z'));
      // 90 minutes already logged from earlier sessions, now 10s into a fresh session.
      setup({ hasOpenSessionMine: true, task: { ...baseTask, totalLoggedMinutes: 90, openClockSessionClockInAt: clockInAt } });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="clock-timer"]').textContent.trim()).toBe('01:30:10');
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the push popup showing the current percent for reference', () => {
    setup({ hasOpenSessionMine: true, task: { ...baseTask, progressPercent: 30 } });
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="push-current-percent"]').textContent).toContain('30');
  });

  it('blocks submission client-side when entered percent is not greater than current', () => {
    setup({ hasOpenSessionMine: true, task: { ...baseTask, progressPercent: 30 } });
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[data-testid="push-percent-input"]') as HTMLInputElement;
    input.value = '30';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="push-submit-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="push-error"]').textContent).toContain('greater than');
  });

  it('blocks submission client-side when entered percent is below current', () => {
    setup({ hasOpenSessionMine: true, task: { ...baseTask, progressPercent: 30 } });
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[data-testid="push-percent-input"]') as HTMLInputElement;
    input.value = '29';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="push-submit-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="push-error"]').textContent).toContain('greater than');
  });

  it('calls Clock In only before emitting clockedIn after the HTTP call resolves', async () => {
    setup({});
    const clockedInSpy = vi.fn();
    fixture.componentInstance.clockedIn.subscribe(clockedInSpy);
    (fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement).click();
    expect(clockedInSpy).not.toHaveBeenCalled();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/clock-in`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await fixture.whenStable();
    expect(clockedInSpy).toHaveBeenCalledTimes(1);
  });

  it('submits an empty optional reason as undefined', async () => {
    setup({ hasOpenSessionMine: true });
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[data-testid="push-percent-input"]') as HTMLInputElement;
    input.value = '60';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="push-submit-button"]') as HTMLButtonElement).click();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/push`);
    expect(req.request.body).toEqual({ percent: 60, reason: undefined });
    req.flush({ ...baseTask, progressPercent: 60, dueDate: null });
    await fixture.whenStable();
  });

  it('keeps the popup open and shows backend detail when Push fails', async () => {
    setup({ hasOpenSessionMine: true });
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[data-testid="push-percent-input"]') as HTMLInputElement;
    input.value = '60';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="push-submit-button"]') as HTMLButtonElement).click();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/push`);
    req.flush({ detail: 'Push rejected by the server.' }, { status: 422, statusText: 'Unprocessable Entity' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.pushPopupOpen()).toBe(true);
    expect(fixture.componentInstance.pushError()).toBe('Push rejected by the server.');
    expect(fixture.componentInstance.pushSubmitting()).toBe(false);
  });

  it('submits Push with percent and reason and emits the updated task', async () => {
    setup({ hasOpenSessionMine: true });
    const pushedSpy = vi.fn();
    fixture.componentInstance.pushed.subscribe(pushedSpy);
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const percentInput = fixture.nativeElement.querySelector('[data-testid="push-percent-input"]') as HTMLInputElement;
    percentInput.value = '60';
    percentInput.dispatchEvent(new Event('input'));
    const reasonInput = fixture.nativeElement.querySelector('[data-testid="push-reason-input"]') as HTMLInputElement;
    reasonInput.value = 'made progress';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="push-submit-button"]') as HTMLButtonElement).click();

    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/push`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ percent: 60, reason: 'made progress' });
    req.flush({
      ...baseTask,
      progressPercent: 60,
      dueDate: null
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pushedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', progressPercent: 60 }));
    expect(fixture.nativeElement.querySelector('[data-testid="push-percent-input"]')).toBeNull();
  });
});
