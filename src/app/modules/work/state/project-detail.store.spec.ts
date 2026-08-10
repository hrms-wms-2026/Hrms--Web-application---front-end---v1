import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ProjectDetailStore } from './project-detail.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';

describe('ProjectDetailStore', () => {
  function setup(apiOverrides: Partial<ProjectApiService> = {}) {
    TestBed.configureTestingModule({ providers: [{ provide: ProjectApiService, useValue: apiOverrides }] });
    return TestBed.inject(ProjectDetailStore);
  }

  const projectDto: ProjectDetailDto = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null,
    leadId: 'u1', startDate: '2026-08-01', targetDate: '2026-12-01', color: null, actualHours: null,
    allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
    createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isLead: true
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

  it('loads and clears a milestone subtree', async () => {
    const response: ObjectiveSubtreeResponseDto = {
      parentObjective: null,
      objective: {
        id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
        description: null, ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
        startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, createdAt: '2026-08-01T00:00:00Z',
        updatedAt: null, children: []
      }
    };
    const store = setup({ getMilestoneSubtree: () => of(response) } as Partial<ProjectApiService>);
    await store.loadMilestoneSubtree('o1');
    expect(store.selectedSubtree()?.title).toBe('Root');
    store.clearSelectedSubtree();
    expect(store.selectedSubtree()).toBeNull();
  });

  it('getMilestoneDetail returns the mapped detail on success', async () => {
    const dto: ObjectiveDetailDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
      description: 'Scope the design work', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
      startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
      allocatedHours: 20, completedHours: 0, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
      isAchieved: false
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
});
