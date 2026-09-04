import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProjectDetailStore } from './project-detail.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ObjectiveMemberApiService } from '../data-access/objective-member-api.service';
import { SprintApiService } from '../data-access/sprint-api.service';
import { TaskApiService } from '../data-access/task-api.service';
import { ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveDetailDto, CreateObjectiveRequestDto, AddObjectiveMemberOutcomeDto, TransferObjectiveHeadOutcomeDto, ObjectiveAssetDto } from '../models/dto/milestone.dto';
import { ObjectiveTreeItemDto } from '../models/dto/objective-tree.dto';
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

  function treeItem(overrides: Partial<ObjectiveTreeItemDto> & Pick<ObjectiveTreeItemDto, 'id' | 'title'>): ObjectiveTreeItemDto {
    return {
      parentObjectiveId: null, isDefault: false, ownerId: 'u1',
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      isActive: true, isAchieved: false, progress: 0, ownerName: 'Arun', isOwner: true, ...overrides
    };
  }

  const leafTree: ObjectiveTreeItemDto[] = [treeItem({ id: 'o1', title: 'Root', isDefault: true })];
  const parentTree: ObjectiveTreeItemDto[] = [
    treeItem({ id: 'o1', title: 'Root', isDefault: true }),
    treeItem({ id: 'o2', title: 'Child', parentObjectiveId: 'o1' })
  ];

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

  it('loads and clears a project tree', async () => {
    const store = setup({ getProjectTree: () => of(leafTree) } as Partial<ProjectApiService>);
    await store.loadProjectTree('p1');
    expect(store.selectedSubtree()?.title).toBe('Root');
    store.clearSelectedSubtree();
    expect(store.selectedSubtree()).toBeNull();
  });

  it('sets subtreeError when loadProjectTree fails', async () => {
    const store = setup({
      getProjectTree: () => throwError(() => ({ error: { detail: 'Server error' } }))
    } as Partial<ProjectApiService>);

    await store.loadProjectTree('p1');

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

    expect(result).toEqual({ success: true, objectiveId: 'o3' });
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

  it('uploadMilestoneAsset returns success:true with the uploaded asset on success', async () => {
    const asset: ObjectiveAssetDto = {
      id: 'a1', fileName: 'plan.pdf', sizeBytes: 2048, contentType: 'application/pdf',
      uploadedAt: '2026-09-02T00:00:00Z', downloadUrl: 'https://signed.example/plan.pdf'
    };
    const store = setup({ uploadObjectiveAsset: () => of(asset) } as Partial<ProjectApiService>);

    const result = await store.uploadMilestoneAsset('o1', new File(['x'], 'plan.pdf'));

    expect(result).toEqual({ success: true, asset });
    expect(store.milestoneActionError()).toBeNull();
  });

  it('uploadMilestoneAsset returns success:false and sets milestoneActionError on failure', async () => {
    const store = setup({
      uploadObjectiveAsset: () => throwError(() => ({ error: { detail: 'file too large' } }))
    } as Partial<ProjectApiService>);

    const result = await store.uploadMilestoneAsset('o1', new File(['x'], 'huge.zip'));

    expect(result).toEqual({ success: false });
    expect(store.milestoneActionError()).toBe('file too large');
  });

  it('deleteMilestoneAsset returns success:true and clears milestoneActionError on success', async () => {
    const store = setup({ deleteObjectiveAsset: () => of(undefined) } as Partial<ProjectApiService>);

    const result = await store.deleteMilestoneAsset('o1', 'a1');

    expect(result).toEqual({ success: true });
    expect(store.milestoneActionError()).toBeNull();
  });

  it('deleteMilestoneAsset returns success:false and sets milestoneActionError on failure', async () => {
    const store = setup({
      deleteObjectiveAsset: () => throwError(() => ({ error: { detail: 'asset not found' } }))
    } as Partial<ProjectApiService>);

    const result = await store.deleteMilestoneAsset('o1', 'a1');

    expect(result).toEqual({ success: false });
    expect(store.milestoneActionError()).toBe('asset not found');
  });

  it('setMilestoneActionError sets and clears the error message directly', () => {
    const store = setup();

    store.setMilestoneActionError('3 file(s) failed to upload.');
    expect(store.milestoneActionError()).toBe('3 file(s) failed to upload.');

    store.setMilestoneActionError(null);
    expect(store.milestoneActionError()).toBeNull();
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

    const sprintDto: SprintDto = {
      id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
      status: 'active', completedAt: null, achievedAt: null
    };

    const directTask: WorkTaskDto = {
      id: 't-direct', objectiveId: 'o1', shortId: 'WEB-1', title: 'Direct task', description: null,
      categoryId: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
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
      const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');

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
      const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');
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
      const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');
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
      const store = setup({ getProjectTree: () => of(parentTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');

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
      const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');

      await store.loadSprintsAndTasksForLeaf('o1');
      expect(store.selectedSubtree()?.sprintTaskLoadState).toBe('error');

      await store.loadSprintsAndTasksForLeaf('o1');
      expect(sprintApi.getByObjective).toHaveBeenCalledTimes(2);
      expect(store.selectedSubtree()?.sprintTaskLoadState).toBe('loaded');
    });
  });

  describe('loadTasksForSprint', () => {

    const sprintDto: SprintDto = {
      id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
      status: 'active', completedAt: null, achievedAt: null
    };

    const sprintTask: WorkTaskDto = {
      id: 't-sprint', objectiveId: 'o1', shortId: 'WEB-2', title: 'Sprint task', description: null,
      categoryId: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0, sprintId: 'spr-1', assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
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
      const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');
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

  describe('achieveSprint and completeSprint', () => {
    it('patches the sprint node after a successful achieve', async () => {
      const achieved: SprintDto = { ...{
        id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
        status: 'achieved' as const, completedAt: null, achievedAt: '2026-08-21'
      } };
      const sprintApi = {
        getByObjective: vi.fn().mockReturnValue(of([{
          id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
          status: 'active' as const, completedAt: null, achievedAt: null
        }])),
        achieve: vi.fn().mockReturnValue(of(achieved))
      };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([])),
        getStatuses: vi.fn().mockReturnValue(of([{
          id: 'st-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null,
          marksTaskComplete: false, visibility: 'public'
        }]))
      };
      const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');
      await store.loadSprintsAndTasksForLeaf('o1');

      const result = await store.achieveSprint('spr-1');

      expect(result.success).toBe(true);
      expect(sprintApi.achieve).toHaveBeenCalledWith('spr-1');
      expect(store.selectedSubtree()?.children[0].status).toBe('achieved');
      expect(store.selectedSubtree()?.children[0].isAchieved).toBe(true);
    });

    it('patches the sprint node after a successful complete', async () => {
      const completed: SprintDto = {
        id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
        status: 'complete', completedAt: '2026-08-21', achievedAt: null
      };
      const sprintApi = {
        getByObjective: vi.fn().mockReturnValue(of([{
          id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
          status: 'active' as const, completedAt: null, achievedAt: null
        }])),
        complete: vi.fn().mockReturnValue(of(completed))
      };
      const taskApi = {
        getTasks: vi.fn().mockReturnValue(of([])),
        getStatuses: vi.fn().mockReturnValue(of([{
          id: 'st-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null,
          marksTaskComplete: false, visibility: 'public'
        }]))
      };
      const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
      await store.loadProjectTree('p1');
      await store.loadSprintsAndTasksForLeaf('o1');

      const result = await store.completeSprint('spr-1');

      expect(result.success).toBe(true);
      expect(store.selectedSubtree()?.children[0].status).toBe('complete');
    });

    it('sets milestoneActionError when achieveSprint fails', async () => {
      const store = setup({}, { achieve: () => throwError(() => ({ error: { detail: 'blocked' } })) });
      const result = await store.achieveSprint('spr-1');
      expect(result.success).toBe(false);
      expect(store.milestoneActionError()).toBe('blocked');
    });
  });

  it('deleteTask removes the node from the tree on success', async () => {
    const sprintApi = { getByObjective: vi.fn().mockReturnValue(of([{
      id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
      status: 'active' as const, completedAt: null, achievedAt: null
    }])) };
    const taskApi = {
      getTasks: vi.fn().mockReturnValue(of([])),
      getStatuses: vi.fn().mockReturnValue(of([{
        id: 'st-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null,
        marksTaskComplete: false, visibility: 'public'
      }])),
      getBySprintId: vi.fn().mockReturnValue(of([{
        id: 't-sprint', objectiveId: 'o1', shortId: 'WEB-2', title: 'Sprint task', description: null,
        categoryId: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0, sprintId: 'spr-1', assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
      }])),
      deleteTask: vi.fn().mockReturnValue(of(undefined))
    };
    const store = setup({ getProjectTree: () => of(leafTree) }, sprintApi, taskApi);
    await store.loadProjectTree('p1');
    await store.loadSprintsAndTasksForLeaf('o1');
    await store.loadTasksForSprint('spr-1');

    const result = await store.deleteTask('t-sprint');

    expect(result.success).toBe(true);
    expect(taskApi.deleteTask).toHaveBeenCalledWith('t-sprint');
    expect(store.selectedSubtree()?.children[0].children.map((c) => c.id)).toEqual([]);
  });

  it('deleteTask leaves the tree unchanged and sets an error on failure', async () => {
    const store = setup(
      { getProjectTree: () => of(leafTree) },
      {},
      { deleteTask: () => throwError(() => ({ error: { detail: 'forbidden' } })) }
    );
    await store.loadProjectTree('p1');
    const before = store.selectedSubtree();

    const result = await store.deleteTask('t-1');

    expect(result.success).toBe(false);
    expect(store.milestoneActionError()).toBe('forbidden');
    expect(store.selectedSubtree()).toBe(before);
  });

  describe('loadProjectMembers', () => {
    const milestones: MyProjectMilestoneDto[] = [{
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
      ownerId: 'u1', ownerName: 'Jane', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
      isOwner: true
    }];

    function setupWithBoth(getMembers: ReturnType<typeof vi.fn>) {
      TestBed.configureTestingModule({
        providers: [
          { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of(milestones)) } },
          { provide: ObjectiveMemberApiService, useValue: { getMembers } },
          { provide: SprintApiService, useValue: {} },
          { provide: TaskApiService, useValue: {} }
        ]
      });
      return TestBed.inject(ProjectDetailStore);
    }

    it('fetches members from every reachable module, excluding pending invites', async () => {
      const getMembers = vi.fn().mockReturnValue(of({
        items: [
          { employeeId: 'e1', pending: false, isHead: true },
          { employeeId: 'e2', pending: true, isHead: false }
        ]
      }));
      const store = setupWithBoth(getMembers);

      await store.loadProjectMembers('p1');

      expect(getMembers).toHaveBeenCalledWith('o1');
      expect(store.projectMembers()).toEqual([{ employeeId: 'e1', pending: false, isHead: true }]);
    });

    it('unions members across multiple modules, deduping by employeeId', async () => {
      // Regression test: assignee dropdowns must include members of every module the caller
      // can reach (cascading ownership), not just the project's Default Objective - a parent
      // member creating a task needs to be able to assign it to a child-module-only member.
      const twoModules: MyProjectMilestoneDto[] = [
        milestones[0],
        {
          ...milestones[0], objectiveId: 'o2', isDefault: false, title: 'Child module', parentObjectiveId: 'o1'
        }
      ];
      TestBed.configureTestingModule({
        providers: [
          { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of(twoModules)) } },
          {
            provide: ObjectiveMemberApiService, useValue: {
              getMembers: vi.fn((objectiveId: string) => of({
                items: objectiveId === 'o1'
                  ? [{ employeeId: 'e1', pending: false, isHead: true }]
                  : [
                      { employeeId: 'e1', pending: false, isHead: false },
                      { employeeId: 'e2', pending: false, isHead: false }
                    ]
              }))
            }
          },
          { provide: SprintApiService, useValue: {} },
          { provide: TaskApiService, useValue: {} }
        ]
      });
      const store = TestBed.inject(ProjectDetailStore);

      await store.loadProjectMembers('p1');

      const employeeIds = store.projectMembers().map((m) => m.employeeId).sort();
      expect(employeeIds).toEqual(['e1', 'e2']);
    });

    it('still returns other modules\' members when one module\'s member fetch fails', async () => {
      const twoModules: MyProjectMilestoneDto[] = [
        milestones[0],
        { ...milestones[0], objectiveId: 'o2', isDefault: false, title: 'Child module', parentObjectiveId: 'o1' }
      ];
      TestBed.configureTestingModule({
        providers: [
          { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of(twoModules)) } },
          {
            provide: ObjectiveMemberApiService, useValue: {
              getMembers: vi.fn((objectiveId: string) => objectiveId === 'o1'
                ? throwError(() => new Error('boom'))
                : of({ items: [{ employeeId: 'e2', pending: false, isHead: false }] }))
            }
          },
          { provide: SprintApiService, useValue: {} },
          { provide: TaskApiService, useValue: {} }
        ]
      });
      const store = TestBed.inject(ProjectDetailStore);

      await store.loadProjectMembers('p1');

      expect(store.projectMembers()).toEqual([{ employeeId: 'e2', pending: false, isHead: false }]);
    });

    it('does not refetch for a project it has already loaded members for', async () => {
      const getMembers = vi.fn().mockReturnValue(of({ items: [] }));
      const store = setupWithBoth(getMembers);

      await store.loadProjectMembers('p1');
      await store.loadProjectMembers('p1');

      expect(getMembers).toHaveBeenCalledTimes(1);
    });

    it('does refetch for a different project id', async () => {
      const getMembers = vi.fn().mockReturnValue(of({ items: [] }));
      const store = setupWithBoth(getMembers);

      await store.loadProjectMembers('p1');
      await store.loadProjectMembers('p2');

      expect(getMembers).toHaveBeenCalledTimes(2);
    });
  });
});
