import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ProjectDetailStore } from './project-detail.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ObjectiveMemberApiService } from '../data-access/objective-member-api.service';
import { SprintApiService } from '../data-access/sprint-api.service';
import { TaskApiService } from '../data-access/task-api.service';
import { ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto, CreateObjectiveRequestDto, AddObjectiveMemberOutcomeDto, TransferObjectiveHeadOutcomeDto } from '../models/dto/milestone.dto';
import { ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { SprintDto } from '../models/dto/sprint.dto';
import { WorkTaskDto, TaskStatusDto } from '../models/dto/task.dto';

describe('ProjectDetailStore', () => {
  function setup(
    apiOverrides: Partial<ProjectApiService> = {},
    sprintApi: Partial<SprintApiService> = {},
    taskApi: Partial<TaskApiService> = {}
  ) {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectApiService, useValue: apiOverrides },
        { provide: SprintApiService, useValue: sprintApi },
        { provide: TaskApiService, useValue: taskApi }
      ]
    });
    return TestBed.inject(ProjectDetailStore);
  }

  function createStoreWithMemberApi(memberApiOverrides: Partial<ObjectiveMemberApiService> = {}) {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProjectApiService, useValue: {} },
        { provide: ObjectiveMemberApiService, useValue: memberApiOverrides },
        { provide: SprintApiService, useValue: {} },
        { provide: TaskApiService, useValue: {} }
      ]
    });
    return TestBed.inject(ProjectDetailStore);
  }

  const projectDto: ProjectDetailDto = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null,
    leadId: 'u1', startDate: '2026-08-01', targetDate: '2026-12-01', color: null, actualHours: null,
    allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
    createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isLead: true, logoFileId: null,
    labels: [], members: [], memberCount: 0
  };

  it('loads a project successfully', async () => {
    const store = setup({ getById: () => of(projectDto) } as Partial<ProjectApiService>);
    await store.loadProject('p1');
    expect(store.project()?.name).toBe('Website Revamp');
    expect(store.projectLoading()).toBe(false);
  });

  it('sets projectError on failure', async () => {
    const store = setup({ getById: () => throwError(() => ({ error: { detail: 'Not found' } })) } as Partial<ProjectApiService>);
    await store.loadProject('p1');
    expect(store.projectError()).toBe('Not found');
    expect(store.project()).toBeNull();
  });

  it('loads milestones independently of the project', async () => {
    const milestones: MyProjectMilestoneDto[] = [{
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
      ownerId: 'u1', ownerName: 'Jane', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
      isOwner: false
    }];
    const store = setup({ getMyMilestones: () => of(milestones) } as Partial<ProjectApiService>);
    await store.loadMyMilestones('p1');
    expect(store.milestones()).toHaveLength(1);
    expect(store.milestonesLoading()).toBe(false);
  });

  it('sets milestonesError on failure', async () => {
    const store = setup({ getMyMilestones: () => throwError(() => ({ error: { detail: 'Server error' } })) } as Partial<ProjectApiService>);
    await store.loadMyMilestones('p1');
    expect(store.milestonesError()).toBe('Server error');
  });

  it('falls back to "Failed to load modules." when the server gives no error detail', async () => {
    const store = setup({ getMyMilestones: () => throwError(() => ({})) } as Partial<ProjectApiService>);
    await store.loadMyMilestones('p1');
    expect(store.milestonesError()).toBe('Failed to load modules.');
  });

  it('loads and clears a milestone subtree', async () => {
    const response: ObjectiveSubtreeResponseDto = {
      parentObjective: null,
      objective: {
        id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
        description: null, ownerId: 'u1', ownerName: 'Arun', reportingManagerId: null, reportingManagerName: null,
        createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, isOwner: true, isAchieved: false, achievedAt: null,
        createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
      }
    };
    const store = setup({ getMilestoneSubtree: () => of(response) } as Partial<ProjectApiService>);
    await store.loadMilestoneSubtree('o1');
    expect(store.selectedSubtree()?.title).toBe('Root');
    store.clearSelectedSubtree();
    expect(store.selectedSubtree()).toBeNull();
  });

  it('sets subtreeError when loadMilestoneSubtree fails', async () => {
    const store = setup({
      getMilestoneSubtree: () => throwError(() => ({ error: { detail: 'Server error' } }))
    } as Partial<ProjectApiService>);

    await store.loadMilestoneSubtree('o1');

    expect(store.subtreeError()).toBe('Server error');
  });

  it('getMilestoneDetail returns the mapped detail on success', async () => {
    const dto: ObjectiveDetailDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
      description: 'Scope the design work', ownerId: 'u1', ownerName: 'Arun', reportingManagerId: null, reportingManagerName: null,
      createdById: 'u1', startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
      allocatedHours: 20, completedHours: 0, isActive: true, isOwner: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
      isAchieved: false, achievedAt: null
    };
    const store = setup({ getObjectiveById: () => of(dto) } as Partial<ProjectApiService>);

    const result = await store.getMilestoneDetail('o1');

    expect(result).toEqual(dto);
    expect(result?.isAchieved).toBe(false);
  });

  it('getMilestoneDetail returns null and sets milestoneActionError on failure', async () => {
    const store = setup({
      getObjectiveById: () => throwError(() => ({ error: { detail: 'not found' } }))
    } as Partial<ProjectApiService>);

    const result = await store.getMilestoneDetail('o1');

    expect(result).toBeNull();
    expect(store.milestoneActionError()).toBe('not found');
  });

  it('editMilestone reports pending:false when applied immediately (200)', async () => {
    const dto = { id: 'o1' } as ObjectiveDetailDto;
    const store = setup({
      editObjective: () => of(new HttpResponse({ body: dto, status: 200 }))
    } as Partial<ProjectApiService>);

    const result = await store.editMilestone('o1', {
      title: 'Design Phase v2', description: 'Updated', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    });

    expect(result).toEqual({ success: true, pending: false });
  });

  it('editMilestone reports pending:true on 202', async () => {
    const store = setup({
      editObjective: () => of(new HttpResponse<ObjectiveDetailDto>({ body: null, status: 202 }))
    } as Partial<ProjectApiService>);

    const result = await store.editMilestone('o1', {
      title: 'Design Phase v2', description: 'Updated', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    });

    expect(result).toEqual({ success: true, pending: true });
  });

  it('achieveMilestone reports pending:false on 204', async () => {
    const store = setup({
      achieveObjective: () => of(new HttpResponse<void>({ status: 204 }))
    } as Partial<ProjectApiService>);

    const result = await store.achieveMilestone('o1');

    expect(result).toEqual({ success: true, pending: false });
  });

  it('unachieveMilestone reports success:false and sets milestoneActionError on failure', async () => {
    const store = setup({
      unachieveObjective: () => throwError(() => ({ error: { detail: 'not achieved' } }))
    } as Partial<ProjectApiService>);

    const result = await store.unachieveMilestone('o1');

    expect(result).toEqual({ success: false, pending: false });
    expect(store.milestoneActionError()).toBe('not achieved');
  });

  it('createSubModule returns success:true and clears milestoneActionError on success', async () => {
    const store = setup({
      createObjective: () => of({ id: 'o3' } as ObjectiveDetailDto)
    } as Partial<ProjectApiService>);

    const result = await store.createSubModule({
      parentObjectiveId: 'o1', title: 'Design Phase', description: null,
      startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
    });

    expect(result).toEqual({ success: true });
    expect(store.milestoneActionError()).toBeNull();
  });

  it('createSubModule returns success:false and sets milestoneActionError on failure', async () => {
    const store = setup({
      createObjective: () => throwError(() => ({ error: { detail: 'date range exceeds parent' } }))
    } as Partial<ProjectApiService>);

    const result = await store.createSubModule({
      parentObjectiveId: 'o1', title: 'Design Phase', description: null,
      startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
    });

    expect(result).toEqual({ success: false });
    expect(store.milestoneActionError()).toBe('date range exceeds parent');
  });

  it('loadObjectiveMembers populates objectiveMembers on success', async () => {
    const memberApi = { getMembers: vi.fn().mockReturnValue(of({ items: [{ employeeId: 'e1', isHead: true, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-01' }] })) };
    const store = createStoreWithMemberApi(memberApi);

    await store.loadObjectiveMembers('o1');

    expect(store.objectiveMembers()).toEqual([{ employeeId: 'e1', isHead: true, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-01' }]);
    expect(store.objectiveMembersError()).toBeNull();
  });

  it('addObjectiveMember reports pending:false when already an active member (204)', async () => {
    const memberApi = { addMember: vi.fn().mockReturnValue(of(new HttpResponse<AddObjectiveMemberOutcomeDto>({ body: { alreadyMember: true, invitation: null }, status: 204 }))) };
    const store = createStoreWithMemberApi(memberApi);

    const result = await store.addObjectiveMember('o1', 'e2');

    expect(result).toEqual({ success: true, alreadyMember: true });
  });

  it('addObjectiveMember reports pending:true (invitation created) on 202', async () => {
    const memberApi = { addMember: vi.fn().mockReturnValue(of(new HttpResponse<AddObjectiveMemberOutcomeDto>({ body: { alreadyMember: false, invitation: { id: 'i1' } as ObjectiveInvitationDto }, status: 202 }))) };
    const store = createStoreWithMemberApi(memberApi);

    const result = await store.addObjectiveMember('o1', 'e2');

    expect(result).toEqual({ success: true, alreadyMember: false });
  });

  it('transferObjectiveHead reports applied:false with a pendingInvitation on 202', async () => {
    const memberApi = { transferHead: vi.fn().mockReturnValue(of(new HttpResponse<TransferObjectiveHeadOutcomeDto>({ body: { applied: false, pendingChangeRequest: null, pendingInvitation: { id: 'i2' } as ObjectiveInvitationDto }, status: 202 }))) };
    const store = createStoreWithMemberApi(memberApi);

    const result = await store.transferObjectiveHead('o1', 'e3');

    expect(result).toEqual({ success: true, applied: false, viaInvitation: true });
  });

  it('loadMyInvitations populates myInvitations', async () => {
    const memberApi = { getMyInvitations: vi.fn().mockReturnValue(of([{ id: 'i1' } as ObjectiveInvitationDto])) };
    const store = createStoreWithMemberApi(memberApi);

    await store.loadMyInvitations();

    expect(store.myInvitations()).toEqual([{ id: 'i1' }]);
  });

  it('acceptInvitation returns success:true and clears the accepted invitation from myInvitations', async () => {
    const memberApi = {
      getMyInvitations: vi.fn().mockReturnValue(of([{ id: 'i1' } as ObjectiveInvitationDto])),
      acceptInvitation: vi.fn().mockReturnValue(of(new HttpResponse<void>({ status: 204 })))
    };
    const store = createStoreWithMemberApi(memberApi);
    await store.loadMyInvitations();

    const result = await store.acceptInvitation('i1');

    expect(result).toEqual({ success: true });
    expect(store.myInvitations()).toEqual([]);
  });

  describe('loadSprintsAndTasksForLeaf', () => {
    const leafSubtree: ObjectiveSubtreeResponseDto = {
      parentObjective: null,
      objective: {
        id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
        description: null, ownerId: 'u1', ownerName: 'Arun', reportingManagerId: null, reportingManagerName: null,
        createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, isOwner: true, isAchieved: false, achievedAt: null,
        createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
      }
    };

    const parentSubtree: ObjectiveSubtreeResponseDto = {
      parentObjective: null,
      objective: {
        ...leafSubtree.objective,
        children: [{ ...leafSubtree.objective, id: 'o2', title: 'Child', parentObjectiveId: 'o1', children: [] }]
      }
    };

    const sprintDto: SprintDto = {
      id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
      status: 'active', completedAt: null, achievedAt: null
    };

    const directTask: WorkTaskDto = {
      id: 't-direct', objectiveId: 'o1', shortId: 'WEB-1', title: 'Direct task', description: null,
      taskType: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: []
    };

    const sprintTask: WorkTaskDto = {
      ...directTask, id: 't-sprint', title: 'Sprint task', sprintId: 'spr-1'
    };

    const statuses: TaskStatusDto[] = [{
      id: 'st-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null,
      marksTaskComplete: false, visibility: 'public'
    }];

    it('fetches sprints, tasks, and statuses once and nests sprint plus direct-task children', async () => {
      const sprintApi = { getByObjective: vi.fn().mockReturnValue(of([sprintDto])) };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([directTask, sprintTask])),
        getStatuses: vi.fn().mockReturnValue(of(statuses))
      };
      const store = setup({ getMilestoneSubtree: () => of(leafSubtree) }, sprintApi, taskApi);
      await store.loadMilestoneSubtree('o1');

      await store.loadSprintsAndTasksForLeaf('o1');

      expect(sprintApi.getByObjective).toHaveBeenCalledTimes(1);
      expect(sprintApi.getByObjective).toHaveBeenCalledWith('o1', false);
      expect(taskApi.getTasks).toHaveBeenCalledTimes(1);
      expect(taskApi.getStatuses).toHaveBeenCalledTimes(1);
      const children = store.selectedSubtree()?.children ?? [];
      expect(children.map((c) => c.kind)).toEqual(['sprint', 'task']);
      expect(children[0].title).toBe('Sprint 1');
      expect(children[0].status).toBe('active');
      expect(children[0].parentObjectiveId).toBe('o1');
      expect(children[1].title).toBe('Direct task');
      expect(children[1].status).toBe('To Do');
      expect(children[1].taskSource?.shortId).toBe('WEB-1');
      expect(children[0].taskStatuses?.[0].name).toBe('To Do');
      expect(store.selectedSubtree()?.sprintTaskLoadState).toBe('loaded');
    });

    it('does not re-fetch when the leaf is already loaded', async () => {
      const sprintApi = { getByObjective: vi.fn().mockReturnValue(of([sprintDto])) };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([])),
        getStatuses: vi.fn().mockReturnValue(of(statuses))
      };
      const store = setup({ getMilestoneSubtree: () => of(leafSubtree) }, sprintApi, taskApi);
      await store.loadMilestoneSubtree('o1');
      await store.loadSprintsAndTasksForLeaf('o1');

      await store.loadSprintsAndTasksForLeaf('o1');

      expect(sprintApi.getByObjective).toHaveBeenCalledTimes(1);
      expect(taskApi.getTasks).toHaveBeenCalledTimes(1);
    });

    it('re-fetches when force is true even if already loaded', async () => {
      const sprintApi = { getByObjective: vi.fn().mockReturnValue(of([sprintDto])) };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([])),
        getStatuses: vi.fn().mockReturnValue(of(statuses))
      };
      const store = setup({ getMilestoneSubtree: () => of(leafSubtree) }, sprintApi, taskApi);
      await store.loadMilestoneSubtree('o1');
      await store.loadSprintsAndTasksForLeaf('o1');

      await store.loadSprintsAndTasksForLeaf('o1', { force: true });

      expect(sprintApi.getByObjective).toHaveBeenCalledTimes(2);
    });

    it('does not fetch sprints or tasks when expanding a non-leaf objective', async () => {
      const sprintApi = { getByObjective: vi.fn().mockReturnValue(of([sprintDto])) };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([])),
        getStatuses: vi.fn().mockReturnValue(of(statuses))
      };
      const store = setup({ getMilestoneSubtree: () => of(parentSubtree) }, sprintApi, taskApi);
      await store.loadMilestoneSubtree('o1');

      await store.loadSprintsAndTasksForLeaf('o1');

      expect(sprintApi.getByObjective).not.toHaveBeenCalled();
      expect(taskApi.getTasks).not.toHaveBeenCalled();
    });

    it('sets error state on failure and retries on the next call', async () => {
      const sprintApi = {
        getByObjective: vi.fn()
          .mockReturnValueOnce(throwError(() => ({ error: { detail: 'boom' } })))
          .mockReturnValueOnce(of([sprintDto]))
      };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([])),
        getStatuses: vi.fn().mockReturnValue(of(statuses))
      };
      const store = setup({ getMilestoneSubtree: () => of(leafSubtree) }, sprintApi, taskApi);
      await store.loadMilestoneSubtree('o1');

      await store.loadSprintsAndTasksForLeaf('o1');
      expect(store.selectedSubtree()?.sprintTaskLoadState).toBe('error');

      await store.loadSprintsAndTasksForLeaf('o1');
      expect(sprintApi.getByObjective).toHaveBeenCalledTimes(2);
      expect(store.selectedSubtree()?.sprintTaskLoadState).toBe('loaded');
    });
  });

  describe('loadTasksForSprint', () => {
    const leafSubtree: ObjectiveSubtreeResponseDto = {
      parentObjective: null,
      objective: {
        id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
        description: null, ownerId: 'u1', ownerName: 'Arun', reportingManagerId: null, reportingManagerName: null,
        createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, isOwner: true, isAchieved: false, achievedAt: null,
        createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
      }
    };

    const sprintDto: SprintDto = {
      id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
      status: 'active', completedAt: null, achievedAt: null
    };

    const sprintTask: WorkTaskDto = {
      id: 't-sprint', objectiveId: 'o1', shortId: 'WEB-2', title: 'Sprint task', description: null,
      taskType: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0, sprintId: 'spr-1', assigneeEmployeeIds: []
    };

    const statuses: TaskStatusDto[] = [{
      id: 'st-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null,
      marksTaskComplete: false, visibility: 'public'
    }];

    async function loadLeafWithSprint(
      getBySprintId: ReturnType<typeof vi.fn>
    ) {
      const sprintApi = { getByObjective: vi.fn().mockReturnValue(of([sprintDto])) };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([])),
        getStatuses: vi.fn().mockReturnValue(of(statuses)),
        getBySprintId
      } as Partial<TaskApiService>;
      const store = setup({ getMilestoneSubtree: () => of(leafSubtree) }, sprintApi, taskApi);
      await store.loadMilestoneSubtree('o1');
      await store.loadSprintsAndTasksForLeaf('o1');
      return { store, getBySprintId };
    }

    it('fetches sprint tasks once and nests them under the sprint', async () => {
      const getBySprintId = vi.fn().mockReturnValue(of([sprintTask]));
      const { store } = await loadLeafWithSprint(getBySprintId);

      await store.loadTasksForSprint('spr-1');

      expect(getBySprintId).toHaveBeenCalledTimes(1);
      expect(getBySprintId).toHaveBeenCalledWith('spr-1');
      const sprintNode = store.selectedSubtree()?.children.find((c) => c.id === 'spr-1');
      expect(sprintNode?.children).toHaveLength(1);
      expect(sprintNode?.children[0].kind).toBe('task');
      expect(sprintNode?.children[0].title).toBe('Sprint task');
      expect(sprintNode?.children[0].status).toBe('To Do');
      expect(sprintNode?.children[0].taskSource?.shortId).toBe('WEB-2');
      expect(sprintNode?.sprintTaskLoadState).toBe('loaded');
    });

    it('does not re-fetch when the sprint is already loaded', async () => {
      const getBySprintId = vi.fn().mockReturnValue(of([sprintTask]));
      const { store } = await loadLeafWithSprint(getBySprintId);
      await store.loadTasksForSprint('spr-1');

      await store.loadTasksForSprint('spr-1');

      expect(getBySprintId).toHaveBeenCalledTimes(1);
    });

    it('re-fetches when force is true even if already loaded', async () => {
      const getBySprintId = vi.fn().mockReturnValue(of([sprintTask]));
      const { store } = await loadLeafWithSprint(getBySprintId);
      await store.loadTasksForSprint('spr-1');

      await store.loadTasksForSprint('spr-1', { force: true });

      expect(getBySprintId).toHaveBeenCalledTimes(2);
    });

    it('sets error state on failure and retries on the next call', async () => {
      const getBySprintId = vi.fn()
        .mockReturnValueOnce(throwError(() => ({ error: { detail: 'boom' } })))
        .mockReturnValueOnce(of([sprintTask]));
      const { store } = await loadLeafWithSprint(getBySprintId);

      await store.loadTasksForSprint('spr-1');
      expect(store.selectedSubtree()?.children[0].sprintTaskLoadState).toBe('error');

      await store.loadTasksForSprint('spr-1');
      expect(getBySprintId).toHaveBeenCalledTimes(2);
      expect(store.selectedSubtree()?.children[0].sprintTaskLoadState).toBe('loaded');
    });
  });
});
