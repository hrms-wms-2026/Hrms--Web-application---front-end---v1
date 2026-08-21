import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
import { ObjectiveTreeItemDto } from '../models/dto/objective-tree.dto';
import { SprintDto } from '../models/dto/sprint.dto';
import { WorkTaskDto } from '../models/dto/task.dto';
import { Project, ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode } from '../models/milestone.model';
import { toWorkTask } from './task.mapper';

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

function toObjectiveForestNode(item: ObjectiveTreeItemDto, children: MilestoneTreeNode[]): MilestoneTreeNode {
  return {
    id: item.id,
    title: item.title,
    description: null,
    startDate: item.startDate,
    endDate: item.endDate,
    progress: item.progress,
    allocatedHours: item.allocatedHours,
    completedHours: item.completedHours,
    isActive: item.isActive,
    isAchieved: item.isAchieved,
    ownerName: item.ownerName,
    isOwner: item.isOwner,
    children,
    kind: 'objective'
  };
}

export function buildObjectiveForest(items: ObjectiveTreeItemDto[]): MilestoneTreeNode | null {
  if (items.length === 0) return null;

  const childrenByParent = new Map<string | null, ObjectiveTreeItemDto[]>();
  for (const item of items) {
    const siblings = childrenByParent.get(item.parentObjectiveId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentObjectiveId, siblings);
  }

  const roots = childrenByParent.get(null) ?? [];
  if (roots.length === 0) return null;
  if (roots.length > 1) {
    console.error(`Objective tree has ${roots.length} root nodes; expected one Default Objective.`);
  }

  const rootItem = roots.find((item) => item.isDefault) ?? roots[0];
  const build = (item: ObjectiveTreeItemDto): MilestoneTreeNode =>
    toObjectiveForestNode(item, (childrenByParent.get(item.id) ?? []).map(build));
  return build(rootItem);
}

export type ActivityFilter = 'all' | 'active' | 'inactive';

export function collectObjectiveOptions(node: MilestoneTreeNode): { id: string; title: string; isActive: boolean }[] {
  const options: { id: string; title: string; isActive: boolean }[] = [];
  const walk = (current: MilestoneTreeNode): void => {
    if ((current.kind ?? 'objective') === 'objective') {
      options.push({ id: current.id, title: current.title, isActive: current.isActive });
    }
    current.children.forEach(walk);
  };
  walk(node);
  return options;
}

export function filterTreeByActivity(node: MilestoneTreeNode, filter: ActivityFilter): MilestoneTreeNode | null {
  if (filter === 'all') return node;
  const wantActive = filter === 'active';
  const isObjective = (n: MilestoneTreeNode) => (n.kind ?? 'objective') === 'objective';
  if (!isObjective(node)) return node;

  const selfMatches = node.isActive === wantActive;
  const filteredChildren = node.children
    .map((child) => (isObjective(child) ? filterTreeByActivity(child, filter) : child))
    .filter((child): child is MilestoneTreeNode => child !== null);

  if (!selfMatches && filteredChildren.length === 0) return null;
  return { ...node, children: filteredChildren };
}

export function pruneTreeToModule(tree: MilestoneTreeNode, moduleId: string): MilestoneTreeNode | null {
  if (moduleId === 'all') return tree;
  const path = findPathToNode(tree, moduleId);
  if (!path) return null;
  let node = path[path.length - 1];
  for (let i = path.length - 2; i >= 0; i--) {
    node = { ...path[i], children: [node] };
  }
  return node;
}

function findPathToNode(node: MilestoneTreeNode, targetId: string): MilestoneTreeNode[] | null {
  if (node.id === targetId) return [node];
  for (const child of node.children) {
    const rest = findPathToNode(child, targetId);
    if (rest) return [node, ...rest];
  }
  return null;
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

export function removeTreeNode(tree: MilestoneTreeNode, targetId: string): MilestoneTreeNode {
  let changed = false;
  const children = tree.children.flatMap((child) => {
    if (child.id === targetId) {
      changed = true;
      return [];
    }
    const next = removeTreeNode(child, targetId);
    if (next !== child) changed = true;
    return [next];
  });
  return changed ? { ...tree, children } : tree;
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
    statusNames: parent.statusNames,
    taskStatuses: parent.taskStatuses
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
    parentObjectiveId: parent.id,
    taskSource: toWorkTask(task),
    taskStatuses: parent.taskStatuses
  };
}
