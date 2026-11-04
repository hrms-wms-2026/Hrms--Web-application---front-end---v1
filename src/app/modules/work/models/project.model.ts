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

export interface CreateProjectPayload {
  categoryId: string;
  name: string;
  identifier: string;
  description: string;
  startDate: string;
  targetDate: string;
  releaseDate: string | null;
  color: string;
  actualHours: number;
  defaultObjectiveAllocatedHours: number;
  logoFile: File | null;
  bannerFile: File | null;
  icon?: string | null;
  memberEmployeeIds: readonly string[];
}

export interface EditProjectPayload {
  name: string;
  description: string;
  categoryId: string;
  startDate: string;
  targetDate: string;
  color: string;
  actualHours: number;
  allocatedHours: number;
  /** Omitted keeps the current icon; '' clears it. */
  icon?: string | null;
}
