import { EditTaskRequestDto, TaskStatusDto, WorkTaskDto } from '../models/dto/task.dto';
import { TaskStatusColumn, WorkTask } from '../models/task.model';

export function toTaskStatusColumn(dto: TaskStatusDto): TaskStatusColumn {
  return {
    id: dto.id,
    name: dto.name,
    displayOrder: dto.displayOrder,
    requiresApproval: dto.requiresApproval,
    approverId: dto.approverId,
    marksTaskComplete: dto.marksTaskComplete,
    visibility: dto.visibility,
    category: dto.category,
    color: dto.color
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
    activeEventName: dto.activeEventName ?? null,
    attachments: (dto.attachments ?? []).map((a) => ({ fileId: a.fileId, name: a.fileName, sizeBytes: a.fileSizeBytes })),
    assignees: (dto.assignees ?? []).map((a) => ({ employeeId: a.employeeId, name: a.name, avatarUrl: a.avatarUrl })),
    parentTaskId: dto.parentTaskId ?? null,
    subtaskTotalCount: dto.subtaskTotalCount ?? 0,
    subtaskCompletedCount: dto.subtaskCompletedCount ?? 0,
    subtaskAssigneeEmployeeIds: dto.subtaskAssigneeEmployeeIds ?? [],
    createdAt: new Date(dto.createdAt)
  };
}

/**
 * EditTaskRequestDto is a full-record replace, not a sparse patch - the backend resets any
 * omitted optional field (title/priority are required; attachmentFileIds omitted clears every
 * attachment). Build the request from the task's current values so a caller only needs to
 * specify what it's actually changing (e.g. sprintId) without risking data loss on the rest.
 */
export function toEditTaskRequest(task: WorkTask, overrides: Partial<EditTaskRequestDto> = {}): EditTaskRequestDto {
  return {
    title: task.title,
    description: task.description || undefined,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : undefined,
    estimatedHours: task.estimatedHours ?? undefined,
    storyPoints: task.storyPoints ?? undefined,
    progressPercent: task.progressPercent,
    sprintId: task.sprintId,
    attachmentFileIds: task.attachments.map((a) => a.fileId),
    ...overrides
  };
}
