import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
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
    children: dto.children.map(toMilestoneTreeNode)
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
