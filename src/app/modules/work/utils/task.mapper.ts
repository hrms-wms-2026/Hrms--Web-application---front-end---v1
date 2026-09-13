import { TaskStatusDto, WorkTaskDto } from '../models/dto/task.dto';
import { TaskStatusColumn, WorkTask } from '../models/task.model';

export function toTaskStatusColumn(dto: TaskStatusDto): TaskStatusColumn {
  return {
    id: dto.id,
    name: dto.name,
    displayOrder: dto.displayOrder,
    requiresApproval: dto.requiresApproval,
    marksTaskComplete: dto.marksTaskComplete,
    visibility: dto.visibility
  };
}

export function toWorkTask(dto: WorkTaskDto): WorkTask {
  return {
    id: dto.id,
    objectiveId: dto.objectiveId,
    shortId: dto.shortId,
    title: dto.title,
    description: dto.description,
    categoryId: dto.categoryId,
    statusId: dto.statusId,
    priority: dto.priority,
    storyPoints: dto.storyPoints,
    dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    estimatedHours: dto.estimatedHours,
    completedHours: dto.completedHours,
    progressPercent: dto.progressPercent,
    sprintId: dto.sprintId,
        assigneeEmployeeIds: dto.assigneeEmployeeIds ?? [],
    openClockSessionEmployeeId: dto.openClockSessionEmployeeId,
    openClockSessionClockInAt: dto.openClockSessionClockInAt ? new Date(dto.openClockSessionClockInAt) : null,
    totalLoggedMinutes: dto.totalLoggedMinutes,
    activeEventId: dto.activeEventId ?? null,
    activeEventName: dto.activeEventName ?? null

  };
}
