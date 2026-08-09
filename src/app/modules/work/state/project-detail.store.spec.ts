import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProjectDetailStore } from './project-detail.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';

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
      objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null
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
});
