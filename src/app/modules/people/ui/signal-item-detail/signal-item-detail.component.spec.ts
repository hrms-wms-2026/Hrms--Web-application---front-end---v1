import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AttendanceDetailDrawerComponent } from '../../../attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeSignalItem } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
import { SignalItemDetailComponent } from './signal-item-detail.component';

@Component({ selector: 'app-attendance-detail-drawer', standalone: true, template: '' })
class DrawerStub { selection = input<unknown>(null); displayTimezone = input('UTC'); fallbackSummary = input<unknown>(null); closed = output<void>(); }
@Component({ selector: 'app-task-form-modal', standalone: true, template: '' })
class TaskModalStub { open = input(false); mode = input('create'); projectId = input.required<string>(); taskId = input(''); closed = output<void>(); saved = output<void>(); }

const item = (over: Partial<EmployeeSignalItem>): EmployeeSignalItem => ({
  kind: 'attendance_day', id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: null, occurredAt: null,
  projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null, ...over
});

describe('SignalItemDetailComponent', () => {
  const project = { loadProject: vi.fn(() => Promise.resolve()), loadMyMilestones: vi.fn(() => Promise.resolve()), projectError: vi.fn(() => null as string | null) };

  async function setup(selected: EmployeeSignalItem, timezone: string | null = 'Asia/Colombo') {
    const getOverviewSignalItems = vi.fn(() => of({ key: 'k', total: 1, timezone, items: [selected] }));
    TestBed.configureTestingModule({
      imports: [SignalItemDetailComponent],
      providers: [EmployeePeriodStore, SignalDrilldownStore, { provide: PeopleApiService, useValue: { getOverviewSignalItems } },
        { provide: ProjectDetailStore, useValue: project }]
    }).overrideComponent(SignalItemDetailComponent, {
      remove: { imports: [AttendanceDetailDrawerComponent, TaskFormModalComponent] },
      add: { imports: [DrawerStub, TaskModalStub] }
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const store = TestBed.inject(SignalDrilldownStore);
    store.setEmployee('emp-1');
    store.open('k');
    await Promise.resolve();
    store.select(selected);
    const fixture = TestBed.createComponent(SignalItemDetailComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => { project.loadProject.mockClear(); project.loadMyMilestones.mockClear(); project.projectError.mockReturnValue(null); });

  it('opens the attendance drawer for a day with employee, date and timezone', async () => {
    const { fixture } = await setup(item({}));
    const drawer = fixture.debugElement.query((d) => d.componentInstance instanceof DrawerStub).componentInstance as DrawerStub;
    expect(drawer.selection()).toEqual({ employeeId: 'emp-1', workDate: '2026-09-02' });
    expect(drawer.displayTimezone()).toBe('Asia/Colombo');
  });

  it('opens the same drawer for a monitoring alert on its date', async () => {
    const { fixture } = await setup(item({ kind: 'monitoring_alert', id: 'n-1', date: '2026-09-05' }));
    const drawer = fixture.debugElement.query((d) => d.componentInstance instanceof DrawerStub).componentInstance as DrawerStub;
    expect(drawer.selection()).toEqual({ employeeId: 'emp-1', workDate: '2026-09-05' });
  });

  it('opens an exception case in the Inbox, where it is reviewed', async () => {
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    const { store } = await setup(item({ kind: 'exception_case', id: 'x-1' }));

    expect(navigate).toHaveBeenCalledWith(['/inbox', 'monitoring', 'exception_case', 'x-1']);
    expect(store.selected()).toBeNull();
    navigate.mockRestore();
  });

  it('loads the project then opens the task modal in edit mode', async () => {
    const { fixture } = await setup(item({ kind: 'task', id: 't-1', projectId: 'p-1', projectName: 'Apollo' }));
    expect(project.loadProject).toHaveBeenCalledWith('p-1');
    expect(project.loadMyMilestones).toHaveBeenCalledWith('p-1');
    const modal = fixture.debugElement.query((d) => d.componentInstance instanceof TaskModalStub).componentInstance as TaskModalStub;
    expect(modal.open()).toBe(true);
    expect(modal.mode()).toBe('edit');
    expect(modal.projectId()).toBe('p-1');
    expect(modal.taskId()).toBe('t-1');
  });

  it('falls back to an Open on board link when the project cannot be loaded', async () => {
    project.projectError.mockReturnValue('Forbidden');
    const { el } = await setup(item({ kind: 'task', id: 't-1', projectId: 'p-1' }));
    expect(el.querySelector('app-task-form-modal')).toBeNull();
    expect((el.querySelector('[data-testid="task-board-fallback"]') as HTMLAnchorElement).getAttribute('href'))
      .toBe('/work/p-1/board?taskId=t-1');
  });
});
