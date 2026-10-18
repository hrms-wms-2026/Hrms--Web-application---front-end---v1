import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProjectDetailStore } from '../../../../work/state/project-detail.store';
import { TaskFormModalComponent } from '../../../../work/ui/task-form-modal/task-form-modal.component';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { EmployeeWorkTaskItem } from '../../../models/employee-overview.model';
import { EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';
import { OffboardingTrackExitWorkStepComponent, overallProgressPercent } from './offboarding-track-exit-work-step.component';

@Component({ selector: 'app-task-form-modal', standalone: true, template: '<div data-testid="task-modal-stub">{{ taskId() }}</div>' })
class TaskFormModalStubComponent {
  readonly open = input(false);
  readonly mode = input('edit');
  readonly projectId = input('');
  readonly taskId = input('');
  readonly saved = output<void>();
  readonly changed = output<void>();
  readonly closed = output<void>();
}

function task(overrides: Partial<EmployeeChecklistTaskResponse>): EmployeeChecklistTaskResponse {
  return {
    id: 'task-1', taskTitle: 'x', ownerType: 'employee', assignedToId: 'u1', dueDate: '2026-12-01',
    isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null, status: 'pending', completedAt: null,
    ...overrides
  };
}

function workTask(overrides: Partial<EmployeeWorkTaskItem>): EmployeeWorkTaskItem {
  return {
    taskId: 't-1', shortId: 'WEB-1', title: 'Fix checkout', bucket: 'not_started', priority: 'high',
    statusName: 'To do', statusColor: '#94a3b8', dueDate: '2026-11-01', daysOverdue: 0, isCarriedOver: false,
    projectId: 'p-1', projectName: 'Website', objectiveId: 'o-1', moduleName: 'Checkout',
    ...overrides
  };
}

describe('overallProgressPercent', () => {
  it('computes the resolved percentage rounded to the nearest integer', () => {
    expect(overallProgressPercent([task({ status: 'completed' }), task({ status: 'pending' }), task({ status: 'pending' })])).toBe(33);
  });
});

describe('OffboardingTrackExitWorkStepComponent', () => {
  const projectError = signal<string | null>(null);
  const projectStore = {
    loadProject: vi.fn(async () => undefined),
    loadMyMilestones: vi.fn(async () => undefined),
    projectError
  };

  async function setup(getOpenWorkTasks: OffboardingApiService['getOpenWorkTasks']): Promise<ComponentFixture<OffboardingTrackExitWorkStepComponent>> {
    projectError.set(null);
    projectStore.loadProject.mockClear();
    projectStore.loadMyMilestones.mockClear();
    await TestBed.configureTestingModule({
      imports: [OffboardingTrackExitWorkStepComponent],
      providers: [
        provideRouter([]),
        { provide: OffboardingApiService, useValue: { getOpenWorkTasks, getOffboarding: () => of(null) } },
        { provide: ProjectDetailStore, useValue: projectStore }
      ]
    })
      .overrideComponent(OffboardingTrackExitWorkStepComponent, {
        remove: { imports: [TaskFormModalComponent] },
        add: { imports: [TaskFormModalStubComponent] }
      })
      .compileComponents();
    const fixture = TestBed.createComponent(OffboardingTrackExitWorkStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the employee\'s open work tasks with an overdue count and opens a task in place', async () => {
    const spy = vi.fn(() => of([
      workTask({ taskId: 't-1', title: 'Late task', bucket: 'overdue', daysOverdue: 3 }),
      workTask({ taskId: 't-2', title: 'Fix checkout' })
    ]));
    const fixture = await setup(spy);
    const el: HTMLElement = fixture.nativeElement;
    expect(spy).toHaveBeenCalledWith('emp-1');
    expect(el.querySelectorAll('[data-testid="exit-work-list"] [data-testid="work-task"]').length).toBe(2);
    expect(el.querySelector('[data-testid="exit-work-summary"]')?.textContent).toContain('2 open tasks');
    expect(el.querySelector('[data-testid="exit-work-summary"]')?.textContent).toContain('1 overdue');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLElement>('[data-testid="work-task"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(projectStore.loadProject).toHaveBeenCalledWith('p-1');
    expect(el.querySelector('[data-testid="task-modal-stub"]')?.textContent).toContain('t-1');

    fixture.componentInstance.closeTask();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="task-modal-stub"]')).toBeNull();
  });

  it('falls back to an "Open on board" link when the task\'s project cannot be opened here', async () => {
    const fixture = await setup(vi.fn(() => of([workTask({ taskId: 't-9', projectId: 'p-9' })])));
    projectError.set('Forbidden');
    const el: HTMLElement = fixture.nativeElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.openTask(fixture.componentInstance.workTasks()[0]);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="task-modal-stub"]')).toBeNull();

    (document.querySelector('[data-testid="exit-work-board-fallback"]') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p-9', 'board'], { queryParams: { taskId: 't-9' } });
  });

  it('reloads the open work list after the opened task was changed', async () => {
    const spy = vi.fn(() => of([workTask({})]));
    const fixture = await setup(spy);
    await fixture.componentInstance.openTask(fixture.componentInstance.workTasks()[0]);
    fixture.componentInstance.taskChanged.set(true);
    fixture.componentInstance.closeTask();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('with no checklist tasks, shows no fake "100% complete" progress', async () => {
    const fixture = await setup(() => of([]));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="exit-checklist-progress"]')).toBeNull();
    expect(el.textContent).not.toContain('100%');
    expect(el.textContent).toContain('No open work');
  });

  it('a failed load (e.g. no work module) still lets the offboarding continue', async () => {
    const fixture = await setup(() => throwError(() => new Error('403')));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain("Assigned work isn't available");
    expect(el.textContent).toContain('Continue to');
  });
});
