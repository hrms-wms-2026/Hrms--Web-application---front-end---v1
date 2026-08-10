import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
import { Project, ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode, ObjectiveDetail } from '../models/milestone.model';

export function toProject(dto: ProjectListItemDto): Project {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead, isAchieved: dto.isAchieved, achievedAt: dto.achievedAt
  };
}

export function toProjectDetail(dto: ProjectDetailDto): ProjectDetail {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead, isAchieved: dto.isAchieved, achievedAt: dto.achievedAt,
    description: dto.description, actualHours: dto.actualHours, createdAt: dto.createdAt,
    updatedAt: dto.updatedAt
  };
}

export function toMilestone(dto: MyProjectMilestoneDto): Milestone {
  return { ...dto };
}

export function toMilestoneTreeNode(dto: ObjectiveSubtreeNodeDto): MilestoneTreeNode {
  return {
    id: dto.id, title: dto.title, startDate: dto.startDate, endDate: dto.endDate,
    progress: dto.progress, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isActive: dto.isActive, children: dto.children.map(toMilestoneTreeNode)
  };
}

export function toObjectiveDetail(dto: ObjectiveSubtreeNodeDto): ObjectiveDetail {
  const { children, ...detail } = dto;
  return detail;
}
