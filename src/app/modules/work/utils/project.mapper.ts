import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
import { SprintDto } from '../models/dto/sprint.dto';
import { WorkTaskDto } from '../models/dto/task.dto';
import { Project, ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode } from '../models/milestone.model';

export function toProject(dto: ProjectListItemDto): Project {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId, description: dto.description,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead, isAchieved: dto.isAchieved, achievedAt: dto.achievedAt, updatedAt: dto.updatedAt,
    logoFileId: dto.logoFileId, labels: dto.labels, members: dto.members, memberCount: dto.memberCount
  };
}

export function toProjectDetail(dto: ProjectDetailDto): ProjectDetail {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId, description: dto.description,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead, isAchieved: dto.isAchieved, achievedAt: dto.achievedAt, logoFileId: dto.logoFileId,
    actualHours: dto.actualHours, createdAt: dto.createdAt, updatedAt: dto.updatedAt,
    labels: dto.labels, members: dto.members, memberCount: dto.memberCount
  };
}

export function toMilestone(dto: MyProjectMilestoneDto): Milestone {
  return { ...dto };
}

export function toMilestoneTreeNode(dto: ObjectiveSubtreeNodeDto): MilestoneTreeNode {
  return {
    id: dto.id, title: dto.title, description: dto.description, startDate: dto.startDate, endDate: dto.endDate,
    progress: dto.progress, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isActive: dto.isActive, isAchieved: dto.isAchieved, ownerName: dto.ownerName, isOwner: dto.isOwner,
    children: dto.children.map(toMilestoneTreeNode),
    kind: 'objective'
  };
}

export function findTreeNode(root: MilestoneTreeNode, id: string): MilestoneTreeNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findTreeNode(child, id);
    if (found) return found;
  }
  return null;
}

export function isLeafObjective(node: MilestoneTreeNode): boolean {
  if ((node.kind ?? 'objective') !== 'objective') return false;
  return node.children.every((child) => child.kind === 'sprint' || child.kind === 'task');
}

export function updateTreeNode(
  tree: MilestoneTreeNode,
  targetId: string,
  updater: (node: MilestoneTreeNode) => MilestoneTreeNode
): MilestoneTreeNode {
  if (tree.id === targetId) return updater(tree);
  let changed = false;
  const children = tree.children.map((child) => {
    const next = updateTreeNode(child, targetId, updater);
    if (next !== child) changed = true;
    return next;
  });
  if (!changed) return tree;
  return { ...tree, children };
}

export function toSprintTreeNode(sprint: SprintDto, parent: MilestoneTreeNode): MilestoneTreeNode {
  return {
    id: sprint.id,
    kind: 'sprint',
    title: sprint.name,
    description: null,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    progress: 0,
    allocatedHours: 0,
    completedHours: 0,
    isActive: true,
    isAchieved: sprint.status === 'achieved',
    ownerName: null,
    isOwner: parent.isOwner,
    children: [],
    sprintTaskLoadState: 'unloaded',
    status: sprint.status,
    parentObjectiveId: parent.id,
    statusNames: parent.statusNames
  };
}

export function toTaskTreeNode(task: WorkTaskDto, parent: MilestoneTreeNode, statusName: string): MilestoneTreeNode {
  return {
    id: task.id,
    kind: 'task',
    title: task.title,
    description: task.description,
    startDate: task.dueDate ?? parent.startDate,
    endDate: task.dueDate ?? parent.endDate,
    progress: task.progressPercent,
    allocatedHours: task.estimatedHours ?? 0,
    completedHours: task.completedHours,
    isActive: true,
    isAchieved: false,
    ownerName: null,
    isOwner: parent.isOwner,
    children: [],
    status: statusName,
    parentObjectiveId: parent.id
  };
}
