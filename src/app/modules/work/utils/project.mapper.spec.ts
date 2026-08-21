import { toProject, toProjectDetail, toMilestone, toMilestoneTreeNode, findTreeNode, isLeafObjective, updateTreeNode, toSprintTreeNode, toTaskTreeNode } from './project.mapper';
import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto } from '../models/dto/milestone.dto';
import { ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
import { MilestoneTreeNode } from '../models/milestone.model';
import { SprintDto } from '../models/dto/sprint.dto';
import { WorkTaskDto } from '../models/dto/task.dto';

describe('project.mapper', () => {
  it('maps a ProjectListItemDto to a Project', () => {
    const dto: ProjectListItemDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
      updatedAt: null, logoFileId: null, labels: [], members: [], memberCount: 0
    };
    expect(toProject(dto)).toEqual({
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
      updatedAt: null, logoFileId: null, labels: [], members: [], memberCount: 0
    });
  });

  it('forwards a non-null logoFileId from ProjectListItemDto to Project', () => {
    const dto: ProjectListItemDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
      updatedAt: null, logoFileId: 'file-123', labels: [], members: [], memberCount: 0
    };
    expect(toProject(dto).logoFileId).toBe('file-123');
  });

  it('forwards description, updatedAt, labels, members, and memberCount from ProjectListItemDto to Project', () => {
    const dto: ProjectListItemDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: 'Rebuild the site', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
      updatedAt: '2026-08-10T00:00:00Z', logoFileId: null,
      labels: [{ id: 'l1', name: 'Marketing', color: '#F59E0B' }],
      members: [{ userId: 'u2', displayName: 'Arun Kumar' }],
      memberCount: 5
    };
    const result = toProject(dto);
    expect(result.description).toBe('Rebuild the site');
    expect(result.updatedAt).toBe('2026-08-10T00:00:00Z');
    expect(result.labels).toEqual([{ id: 'l1', name: 'Marketing', color: '#F59E0B' }]);
    expect(result.members).toEqual([{ userId: 'u2', displayName: 'Arun Kumar' }]);
    expect(result.memberCount).toBe(5);
  });

  it('maps a ProjectDetailDto to a ProjectDetail', () => {
    const dto: ProjectDetailDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: 'Rebuild',
      leadId: 'u1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB',
      actualHours: 12, allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false,
      achievedAt: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isLead: true, logoFileId: 'file-456',
      labels: [], members: [], memberCount: 0
    };
    const result = toProjectDetail(dto);
    expect(result.description).toBe('Rebuild');
    expect(result.isAchieved).toBe(false);
    expect(result.createdAt).toBe('2026-08-01T00:00:00Z');
    expect(result.logoFileId).toBe('file-456');
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
        ownerName: 'Arun Kumar', isOwner: true, children: [], kind: 'objective'
      });
    });

    it('maps every node in a subtree response to kind objective', () => {
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

      expect(result.kind).toBe('objective');
      expect(result.children[0].kind).toBe('objective');
    });
  });

  describe('isLeafObjective', () => {
    const base: MilestoneTreeNode = {
      id: 'o1', title: 'Root', description: null, startDate: '2026-01-15', endDate: '2026-03-01',
      progress: 0, allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false,
      ownerName: 'Arun', isOwner: true, children: []
    };

    it('returns true for an objective with no children', () => {
      expect(isLeafObjective({ ...base, kind: 'objective', children: [] })).toBe(true);
    });

    it('returns true for an objective whose children are only sprints or tasks', () => {
      const sprintChild: MilestoneTreeNode = {
        ...base, id: 's1', title: 'Sprint 1', kind: 'sprint', children: []
      };
      expect(isLeafObjective({ ...base, kind: 'objective', children: [sprintChild] })).toBe(true);
    });

    it('returns false for an objective that has child objectives', () => {
      const child: MilestoneTreeNode = { ...base, id: 'o2', title: 'Child', kind: 'objective' };
      expect(isLeafObjective({ ...base, kind: 'objective', children: [child] })).toBe(false);
    });

    it('returns false for sprint and task nodes', () => {
      expect(isLeafObjective({ ...base, kind: 'sprint' })).toBe(false);
      expect(isLeafObjective({ ...base, kind: 'task' })).toBe(false);
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

  describe('updateTreeNode', () => {
    const leaf: MilestoneTreeNode = {
      id: 'o2', title: 'Child', description: null, startDate: '2026-01-20', endDate: '2026-02-01',
      progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
      ownerName: 'Diya', isOwner: false, children: []
    };
    const sibling: MilestoneTreeNode = {
      id: 'o3', title: 'Sibling', description: null, startDate: '2026-01-20', endDate: '2026-02-01',
      progress: 0, allocatedHours: 5, completedHours: 0, isActive: true, isAchieved: false,
      ownerName: 'Diya', isOwner: false, children: []
    };
    const root: MilestoneTreeNode = {
      id: 'o1', title: 'Root', description: null, startDate: '2026-01-15', endDate: '2026-03-01',
      progress: 0, allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false,
      ownerName: 'Arun', isOwner: true, children: [leaf, sibling]
    };

    it('rebuilds only the path to the target with new object references', () => {
      const next = updateTreeNode(root, 'o2', (node) => ({ ...node, title: 'Updated' }));

      expect(next).not.toBe(root);
      expect(next.children[0]).not.toBe(leaf);
      expect(next.children[0].title).toBe('Updated');
      expect(next.children[1]).toBe(sibling);
    });

    it('returns the same tree reference when the id is not found', () => {
      const next = updateTreeNode(root, 'missing', (node) => ({ ...node, title: 'Updated' }));
      expect(next).toBe(root);
    });
  });

  it('stashes task source and status columns on sprint and task tree nodes', () => {
    const parent: MilestoneTreeNode = {
      id: 'o1', title: 'Root', description: null, startDate: '2026-01-01', endDate: '2026-12-01',
      progress: 0, allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false,
      ownerName: 'Arun', isOwner: true, children: [], kind: 'objective',
      taskStatuses: [{
        id: 'st-1', name: 'To Do', displayOrder: 0, requiresApproval: false,
        marksTaskComplete: false, visibility: 'public'
      }]
    };
    const sprintDto: SprintDto = {
      id: 'spr-1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-08-01', endDate: '2026-08-14',
      status: 'active', completedAt: null, achievedAt: null
    };
    const taskDto: WorkTaskDto = {
      id: 't1', objectiveId: 'o1', shortId: 'WEB-9', title: 'Do it', description: null,
      taskType: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0,
      sprintId: 'spr-1', assigneeEmployeeIds: []
    };

    const sprint = toSprintTreeNode(sprintDto, parent);
    expect(sprint.taskStatuses?.[0].name).toBe('To Do');

    const task = toTaskTreeNode(taskDto, sprint, 'To Do');
    expect(task.taskSource?.shortId).toBe('WEB-9');
    expect(task.taskSource?.sprintId).toBe('spr-1');
    expect(task.taskStatuses?.[0].name).toBe('To Do');
  });
});
