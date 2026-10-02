import { AttachmentPill } from '../../ui/task-attachment-list/task-attachment-list.component';

export interface TaskCommentReactorDto {
  employeeId: string;
  name: string;
}

export interface TaskCommentReactionDto {
  emoji: string;
  employeeIds: string[];
  reactors: TaskCommentReactorDto[];
}

export interface TaskCommentDto {
  id: string;
  taskId: string;
  parentCommentId: string | null;
  employeeId: string;
  employeeName: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  reactions: TaskCommentReactionDto[];
  attachments: AttachmentPill[];
  replies: TaskCommentDto[];
}

export interface CreateTaskCommentRequestDto {
  content: string;
  attachmentFileIds: string[];
}

export interface EditTaskCommentRequestDto {
  content: string;
  attachmentFileIds: string[];
}
