import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkOverviewResponse, EmployeeWorkTaskItem } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewWorkWidgetComponent } from './overview-work-widget.component';

describe('OverviewWorkWidgetComponent', () => {
  const response: EmployeeWorkOverviewResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    assigned: 24,
    completed: 18,
    inProgress: 5,
    overdue: 1,
    notStarted: 0,
    completionRatePercent: 75,
    onTimeRatePercent: 89
  };

  function setup(getOverviewWork: ReturnType<typeof vi.fn>, getOverviewWorkTasks: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(of({ from: '', to: '', items: tasks }))) {
    TestBed.configureTestingModule({
      imports: [OverviewWorkWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewWork, getOverviewWorkTasks } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewWorkWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const task = (taskId: string, bucket: EmployeeWorkTaskItem['bucket'], priority: string, over: Partial<EmployeeWorkTaskItem> = {}): EmployeeWorkTaskItem => ({
    taskId, shortId: 'WEB-' + taskId, title: 'Task ' + taskId, bucket, priority, statusName: 'To do', statusColor: '#94a3b8',
    dueDate: '2026-09-20', daysOverdue: 0, isCarriedOver: false, projectId: 'p1', projectName: 'Website',
    objectiveId: 'o1', moduleName: 'Checkout', ...over
  });
  const tasks: EmployeeWorkTaskItem[] = [
    task('1', 'overdue', 'high', { daysOverdue: 3, dueDate: '2026-09-10' }),
    task('2', 'not_started', 'critical'),
    task('3', 'in_progress', 'medium'),
    task('4', 'completed', 'low')
  ];
  const isOpen = (el: HTMLElement) => el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open');

  const text = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!;

  it('requests the selected month for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows assigned, completed, in progress and overdue counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(text(el, 'work-assigned')).toContain('24 tasks');
    expect(text(el, 'work-completed')).toContain('18');
    expect(text(el, 'work-in-progress')).toContain('5');
    expect(text(el, 'work-overdue')).toContain('1');
  });

  it('keeps the title on one line and has no View tasks link (the card itself opens the tasks)', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelector('h2')!.classList.contains('whitespace-nowrap')).toBe(true);
    expect(el.textContent).not.toContain('View tasks');
  });

  it('aligns legend values in one numeric column and distributes card sections', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const layout = el.querySelector('[data-testid="work-layout"]')!;
    const legend = el.querySelector('[data-testid="work-legend"]')!;
    const values = [...legend.querySelectorAll('dd')];

    expect(layout.children).toHaveLength(2);
    expect(legend.classList.contains('grid-cols-[minmax(0,1fr)_auto]')).toBe(true);
    expect(values.every((value) => value.classList.contains('tabular-nums'))).toBe(true);
  });

  it('draws one pie slice per non-zero status, with no separate progress bar', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelectorAll('[data-testid="pie-slice"]')).toHaveLength(3);
    expect(el.querySelector('[data-testid="seg-completed"]')).toBeNull();
    expect(text(el, 'work-not-started')).toContain('0');
  });

  it('shows the completion and on-time rates, and a dash when the on-time rate is unknown', () => {
    const known = setup(vi.fn().mockReturnValue(of(response)));
    expect(text(known.el, 'work-completion-rate')).toContain('75%');
    expect(text(known.el, 'work-ontime-rate')).toContain('89%');

    TestBed.resetTestingModule();
    const unknown = setup(vi.fn().mockReturnValue(of({ ...response, onTimeRatePercent: null })));
    expect(text(unknown.el, 'work-ontime-rate')).toContain('—');
  });

  it('shows the empty state when no tasks belong to the period', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, assigned: 0, completed: 0, inProgress: 0, overdue: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('refetches when the month changes', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
  });

  it('shows a good completed delta against the picked compare month', () => {
    const compare = { ...response, from: '2026-08-01', to: '2026-08-31', completed: 15 };
    const get = vi.fn((_id: string, from: string) => of(from === '2026-08-01' ? compare : response));
    const { fixture, store, el } = setup(get);

    store.setCompareMonth('2026-08');
    fixture.detectChanges();

    const delta = el.querySelector('[data-testid="delta"]')!;
    expect(delta.textContent).toContain('▲ +3');
    expect(delta.classList.contains('delta--good')).toBe(true);
  });

  it('does not load the task list until the card is opened', () => {
    const getTasks = vi.fn().mockReturnValue(of({ from: '', to: '', items: tasks }));
    const { el } = setup(vi.fn().mockReturnValue(of(response)), getTasks);

    expect(getTasks).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="work-task-list"]')).toBeNull();
    expect(el.querySelector('[data-testid="work-toggle"]')!.textContent).toContain('View all (24)');
  });

  it('pops out wide on a card click with the tasks grouped overdue, not started, in progress, completed', () => {
    const getTasks = vi.fn().mockReturnValue(of({ from: '', to: '', items: tasks }));
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)), getTasks);

    (el.querySelector('app-widget-card') as HTMLElement).click();
    fixture.detectChanges();

    expect(isOpen(el)).toBe(true);
    expect(getTasks).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
    const groups = [...el.querySelectorAll<HTMLElement>('[data-testid="work-task-group"]')].map((g) => g.dataset['bucket']);
    expect(groups).toEqual(['overdue', 'not_started', 'in_progress', 'completed']);
    expect(el.querySelector('[data-testid="work-task-list"] h3')).toBeNull();
  });

  it('shows each task with title, due date, status, priority, project and module', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)));
    (el.querySelector('[data-testid="work-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const first = el.querySelector('[data-testid="work-task"]')!;
    expect(first.textContent).toContain('Task 1');
    expect(first.querySelector('[data-testid="work-task-priority"]')!.textContent).toContain('high');
    expect(first.querySelector('[data-testid="work-task-status"]')!.textContent).toContain('To do');
    expect(first.querySelector('[data-testid="work-task-where"]')!.textContent).toContain('Website');
    expect(first.querySelector('[data-testid="work-task-where"]')!.textContent).toContain('Checkout');
    expect(first.querySelector('[data-testid="work-task-due"]')!.textContent).toContain('Sep 10, 2026');
    expect(first.querySelector('[data-testid="work-task-due"]')!.textContent).toContain('3d late');
  });

  it('puts the rates beside the pie and legend while popped out, and back underneath when closed', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)));
    const layout = el.querySelector('[data-testid="work-layout"]')!;
    expect(layout.classList.contains('work-layout--wide')).toBe(false);

    (el.querySelector('[data-testid="work-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(layout.classList.contains('work-layout--wide')).toBe(true);
    expect(layout.querySelector('.work-rates')).toBeTruthy();
  });

  it('on the card: hover-revealed Refreshed / refresh / expand; refresh there reloads only the counts', () => {
    const getWork = vi.fn().mockReturnValue(of(response));
    const getTasks = vi.fn().mockReturnValue(of({ from: '', to: '', items: tasks }));
    const { fixture, el } = setup(getWork, getTasks);
    const actions = el.querySelector('[data-testid="popout-header-actions"]')!;

    expect(actions.classList.contains('reveal')).toBe(true);
    expect(el.querySelector('[data-testid="refreshed-label"]')!.textContent).toContain('Refreshed just now');
    expect(el.querySelector('[data-testid="popout-close"]')).toBeNull();

    (el.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getWork).toHaveBeenCalledTimes(2);
    expect(getTasks).not.toHaveBeenCalled();

    (el.querySelector('[data-testid="popout-expand"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(isOpen(el)).toBe(true);
    expect(el.querySelector('[data-testid="popout-header-actions"]')!.classList.contains('reveal')).toBe(false);
  });

  it('in the popup: refresh / close; refresh refetches both without clearing the list', () => {
    const getWork = vi.fn().mockReturnValue(of(response));
    const getTasks = vi.fn().mockReturnValue(of({ from: '', to: '', items: tasks }));
    const { fixture, el } = setup(getWork, getTasks);

    (el.querySelector('[data-testid="work-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="refreshed-label"]')!.textContent).toContain('Refreshed just now');

    (el.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getWork).toHaveBeenCalledTimes(2);
    expect(getTasks).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('[data-testid="work-task"]')).toHaveLength(4);

    (el.querySelector('[data-testid="popout-close"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(isOpen(el)).toBe(false);
  });

  it('emits the clicked task without closing the list, and reuses the list when reopened', () => {
    const getTasks = vi.fn().mockReturnValue(of({ from: '', to: '', items: tasks }));
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)), getTasks);
    const selected = vi.fn();
    fixture.componentInstance.taskSelected.subscribe(selected);
    (el.querySelector('[data-testid="work-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (el.querySelectorAll('[data-testid="work-task"]')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(selected).toHaveBeenCalledWith(tasks[1]);
    expect(isOpen(el)).toBe(true);

    (el.querySelector('[data-testid="work-toggle"]') as HTMLButtonElement).click(); // Show less
    fixture.detectChanges();
    (el.querySelector('[data-testid="work-toggle"]') as HTMLButtonElement).click(); // reopen
    fixture.detectChanges();
    expect(getTasks).toHaveBeenCalledTimes(1);
  });

  it('refetches the list for a new month only if it is open', () => {
    const getTasks = vi.fn().mockReturnValue(of({ from: '', to: '', items: tasks }));
    const { fixture, store, el } = setup(vi.fn().mockReturnValue(of(response)), getTasks);
    (el.querySelector('[data-testid="work-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(getTasks).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
    expect(getTasks).toHaveBeenCalledTimes(2);
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
