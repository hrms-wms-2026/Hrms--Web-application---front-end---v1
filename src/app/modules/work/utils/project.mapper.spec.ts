import { toProject, toProjectDetail, toMilestone, toMilestoneTreeNode, findTreeNode } from './project.mapper';
import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto } from '../models/dto/milestone.dto';
import { ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
import { MilestoneTreeNode } from '../models/milestone.model';

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
      ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null,
      membershipIsActive: true, membershipRemovedAt: null, isOwner: false
    };
    expect(toMilestone(dto).ownerName).toBe('Jane Doe');
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
      description: null, ownerId: 'u1', ownerName: 'Arun Kumar', reportingManagerId: null, reportingManagerName: null,
      createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, isOwner: true, isAchieved: false, achievedAt: null,
      createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
      children: [
        {
          id: 'o2', projectId: 'p1', parentObjectiveId: 'o1', isDefault: false, title: 'Child',
          description: null, ownerId: 'u1', ownerName: 'Diya', reportingManagerId: 'u1', reportingManagerName: 'Arun Kumar',
          createdById: 'u1', startDate: '2026-08-01', endDate: '2026-09-01', progress: 0, actualHours: null,
          allocatedHours: 10, completedHours: 0, isActive: true, isOwner: false, isAchieved: false, achievedAt: null,
          createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
        }
      ]
    };
    const result = toMilestoneTreeNode(dto);
    expect(result.title).toBe('Root');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].title).toBe('Child');
    expect(result.children[0].children).toEqual([]);
  });

  describe('toMilestoneTreeNode', () => {
    it('maps description, isAchieved, ownerName, and isOwner', () => {
      const dto: ObjectiveSubtreeNodeDto = {
        id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
        description: 'Root scope', ownerId: 'u1', ownerName: 'Arun Kumar',
        reportingManagerId: null, reportingManagerName: null, createdById: 'u1',
        startDate: '2026-01-01', endDate: '2026-12-01', progress: 72, actualHours: null,
        allocatedHours: 40, completedHours: 29, isActive: true, isOwner: true,
        isAchieved: false, achievedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
        children: []
      };

      const node = toMilestoneTreeNode(dto);

      expect(node).toEqual({
        id: 'o1', title: 'Root', description: 'Root scope', startDate: '2026-01-01', endDate: '2026-12-01',
        progress: 72, allocatedHours: 40, completedHours: 29, isActive: true, isAchieved: false,
        ownerName: 'Arun Kumar', isOwner: true, children: []
      });
    });
  });

  describe('findTreeNode', () => {
    const leaf: MilestoneTreeNode = {
      id: 'o2', title: 'Child', description: null, startDate: '2026-01-20', endDate: '2026-02-01',
      progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
      ownerName: 'Diya', isOwner: false, children: []
    };
    const root: MilestoneTreeNode = {
      id: 'o1', title: 'Root', description: null, startDate: '2026-01-15', endDate: '2026-03-01',
      progress: 0, allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false,
      ownerName: 'Arun', isOwner: true, children: [leaf]
    };

    it('finds the root node by id', () => {
      expect(findTreeNode(root, 'o1')).toBe(root);
    });

    it('finds a nested child node by id', () => {
      expect(findTreeNode(root, 'o2')).toBe(leaf);
    });

    it('returns null when the id is not in the tree', () => {
      expect(findTreeNode(root, 'missing')).toBeNull();
    });
  });
});
