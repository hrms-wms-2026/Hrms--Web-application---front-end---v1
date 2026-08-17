import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { TaskBacklogComponent } from './task-backlog.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ObjectiveMemberApiService } from '../../data-access/objective-member-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintListStore } from '../../state/sprint-list.store';
import { SprintListComponent } from '../../ui/sprint-list/sprint-list.component';
import { SprintDto } from '../../models/dto/sprint.dto';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('TaskBacklogComponent', () => {
  const sprintDto: SprintDto = {
    id: 'sp-1',
    objectiveId: 'milestone-1',
    name: 'Sprint Foundation E2E',
    startDate: '2026-08-17',
    endDate: '2026-08-31',
    status: 'active',
    completedAt: null,
    achievedAt: null
  };

  async function setup(getByObjective = vi.fn().mockReturnValue(of([]))) {
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [TaskBacklogComponent],
      providers: [
        {
          provide: TaskBoardStore,
          useValue: {
            loadBoard,
            tasks: () => [],
            statuses: () => [],
            loading: () => false,
            error: () => null
          }
        },
        {
          provide: ProjectDetailStore,
          useValue: {
            milestones: () => [{ objectiveId: 'milestone-1', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null)
          }
        },
        { provide: SprintApiService, useValue: { getByObjective } },
        { provide: ObjectiveMemberApiService, useValue: { getMembers: vi.fn().mockReturnValue(of({ items: [] })) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn() } },
        {
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
        {
          provide: SprintListStore,
          useValue: {
            sprints: signal([]),
            error: signal(null),
            loading: signal(false),
            load: vi.fn().mockResolvedValue(undefined),
            create: vi.fn(),
            edit: vi.fn(),
            complete: vi.fn(),
            achieve: vi.fn()
          }
        },
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } } }
        }
      ]
    });

    const fixture = TestBed.createComponent(TaskBacklogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, loadBoard, getByObjective };
  }

  it('loads the board for the current milestoneId on init', async () => {
    const { loadBoard } = await setup();
    expect(loadBoard).toHaveBeenCalledWith('milestone-1');
  });

  it('reloads active sprints into the create-task modal after the sprint list changes', async () => {
    const getByObjective = vi.fn()
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(of([sprintDto]));
    const { fixture } = await setup(getByObjective);

    const sprintList = fixture.debugElement.query(By.directive(SprintListComponent)).componentInstance as SprintListComponent;
    sprintList.sprintsChanged.emit();
    await fixture.whenStable();
    fixture.detectChanges();

    const createTaskButton = Array.from(fixture.nativeElement.querySelectorAll('button') as HTMLButtonElement[])
      .find((b) => b.textContent?.includes('Create task'));
    createTaskButton?.click();
    fixture.detectChanges();

    const options = Array.from(fixture.nativeElement.querySelectorAll('select.task-create-modal__select option') as HTMLOptionElement[])
      .map((o) => o.textContent?.trim());
    expect(options).toContain('Sprint Foundation E2E');
  });

  it('resolves assignableMembers names from the employee directory instead of the raw employeeId', async () => {
    const directoryGet = vi.fn((id: string) => (id === 'emp-1' ? { id, name: 'Nevi Peiris', initials: 'NP', avatarUrl: null } : undefined));
    const directoryEnsureLoaded = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [TaskBacklogComponent],
      providers: [
        {
          provide: TaskBoardStore,
          useValue: {
            loadBoard: vi.fn().mockResolvedValue(undefined),
            tasks: () => [],
            statuses: () => [],
            loading: () => false,
            error: () => null
          }
        },
        {
          provide: ProjectDetailStore,
          useValue: {
            milestones: () => [{ objectiveId: 'milestone-1', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null)
          }
        },
        { provide: SprintApiService, useValue: { getByObjective: vi.fn().mockReturnValue(of([])) } },
        {
          provide: ObjectiveMemberApiService,
          useValue: {
            getMembers: vi.fn().mockReturnValue(of({
              items: [
                { employeeId: 'emp-1', pending: false, isHead: false },
                { employeeId: 'emp-2', pending: false, isHead: false }
              ]
            }))
          }
        },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn() } },
        { provide: EmployeeDirectoryStore, useValue: { get: directoryGet, ensureLoaded: directoryEnsureLoaded } },
        {
          provide: SprintListStore,
          useValue: {
            sprints: signal([]),
            error: signal(null),
            loading: signal(false),
            load: vi.fn().mockResolvedValue(undefined),
            create: vi.fn(),
            edit: vi.fn(),
            complete: vi.fn(),
            achieve: vi.fn()
          }
        },
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } } }
        }
      ]
    });

    const fixture = TestBed.createComponent(TaskBacklogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(directoryEnsureLoaded).toHaveBeenCalledWith(['emp-1', 'emp-2']);
    const members = (fixture.componentInstance as unknown as { assignableMembers: () => { employeeId: string; name: string }[] }).assignableMembers();
    expect(members).toEqual([
      { employeeId: 'emp-1', name: 'Nevi Peiris' },
      { employeeId: 'emp-2', name: 'Unknown employee' }
    ]);
    expect(members.find((m) => m.employeeId === 'emp-1')?.name).not.toBe('emp-1');
    expect(members.find((m) => m.employeeId === 'emp-2')?.name).not.toBe('emp-2');
  });
});
