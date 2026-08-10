import { toProject, toProjectDetail, toMilestone, toMilestoneTreeNode, toObjectiveDetail } from './project.mapper';
import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto } from '../models/dto/milestone.dto';
import { ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';

describe('project.mapper', () => {
  it('maps a ProjectListItemDto to a Project', () => {
    const dto: ProjectListItemDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null
    };
    expect(toProject(dto)).toEqual({
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null
    });
  });

  it('maps a ProjectDetailDto to a ProjectDetail', () => {
    const dto: ProjectDetailDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: 'Rebuild',
      leadId: 'u1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB',
      actualHours: 12, allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false,
      achievedAt: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isLead: true
    };
    const result = toProjectDetail(dto);
    expect(result.description).toBe('Rebuild');
    expect(result.isAchieved).toBe(false);
    expect(result.createdAt).toBe('2026-08-01T00:00:00Z');
  });

  it('maps a MyProjectMilestoneDto to a Milestone', () => {
    const dto: MyProjectMilestoneDto = {
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
      ownerId: 'u1', ownerName: 'Jane', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null,
      membershipIsActive: true, membershipRemovedAt: null, isOwner: false
    };
    expect(toMilestone(dto).ownerName).toBe('Jane');
  });

  it('maps isOwner through unchanged', () => {
    const dto: MyProjectMilestoneDto = {
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
      ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null,
      membershipIsActive: true, membershipRemovedAt: null, isOwner: true
    };

    const result = toMilestone(dto);

    expect(result.isOwner).toBe(true);
  });

  it('maps an ObjectiveSubtreeNodeDto to a MilestoneTreeNode, recursively', () => {
    const dto: ObjectiveSubtreeNodeDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
      createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, isAchieved: false, achievedAt: null,
      isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
      children: [
        {
          id: 'o2', projectId: 'p1', parentObjectiveId: 'o1', isDefault: false, title: 'Child',
          description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: 'u1', reportingManagerName: 'Jane Doe',
          createdById: 'u1', startDate: '2026-08-01', endDate: '2026-09-01', progress: 0, actualHours: null,
          allocatedHours: 10, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
          isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
        }
      ]
    };
    const result = toMilestoneTreeNode(dto);
    expect(result.title).toBe('Root');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].title).toBe('Child');
    expect(result.children[0].children).toEqual([]);
  });

  it('maps an ObjectiveSubtreeNodeDto to an ObjectiveDetail, dropping children', () => {
    const dto: ObjectiveSubtreeNodeDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: 'Scope', ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: 'u2', reportingManagerName: 'John Smith',
      createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, isAchieved: true, achievedAt: '2026-08-05T00:00:00Z',
      isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
    };

    const result = toObjectiveDetail(dto);

    expect(result).toEqual({
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: 'Scope', ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: 'u2', reportingManagerName: 'John Smith',
      createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, isAchieved: true, achievedAt: '2026-08-05T00:00:00Z',
      isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
    });
    expect('children' in result).toBe(false);
  });
});
