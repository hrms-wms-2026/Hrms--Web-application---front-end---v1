import { CreateProjectRequestDto, EditProjectRequestDto } from './dto/project.dto';

export interface ProjectLabel {
  id: string;
  name: string;
  color: string;
}

export interface ProjectMemberAvatar {
  userId: string;
  displayName: string;
  avatarFileId: string | null;
}

export interface Project {
  id: string;
  name: string;
  identifier: string;
  categoryId: string;
  description: string | null;
  leadId: string;
  startDate: string;
  targetDate: string;
  color: string | null;
  isActive: boolean;
  allocatedHours: number;
  completedHours: number;
  isLead: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  updatedAt: string | null;
  logoFileId: string | null;
  labels: ProjectLabel[];
  members: ProjectMemberAvatar[];
  memberCount: number;
  systemPurpose?: string | null;
  /** "lucide:{name}" or "emoji:{emoji}"; null shows the logo or initials. */
  icon?: string | null;
}

export interface ProjectDetail extends Project {
  actualHours: number | null;
  createdAt: string;
}

/** The create-project form payload, sent to the backend unchanged (`CreateProjectRequestDto`). */
export type CreateProjectPayload = CreateProjectRequestDto;

/** The edit-project form payload, sent to the backend unchanged (`EditProjectRequestDto`). */
export type EditProjectPayload = EditProjectRequestDto;
