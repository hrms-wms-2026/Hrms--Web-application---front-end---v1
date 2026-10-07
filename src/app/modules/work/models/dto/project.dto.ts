export interface LabelDto {
  id: string;
  name: string;
  color: string;
}

export interface ProjectMemberAvatarDto {
  userId: string;
  displayName: string;
  avatarFileId: string | null;
}

export interface ProjectListItemDto {
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
  labels: LabelDto[];
  members: ProjectMemberAvatarDto[];
  memberCount: number;
  systemPurpose?: string | null;
}

export interface PagedResultDto<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ProjectDetailDto {
  id: string;
  name: string;
  identifier: string;
  categoryId: string;
  description: string | null;
  leadId: string;
  startDate: string;
  targetDate: string;
  color: string | null;
  actualHours: number | null;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  isLead: boolean;
  logoFileId: string | null;
  labels: LabelDto[];
  members: ProjectMemberAvatarDto[];
  memberCount: number;
  systemPurpose?: string | null;
}

export interface CreateProjectResponseDto {
  project: { id: string; name: string };
}

export interface CreateProjectRequestDto {
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
  memberEmployeeIds: readonly string[];
}

export interface EditProjectRequestDto {
  name: string;
  description: string;
  categoryId: string;
  startDate: string;
  targetDate: string;
  color: string;
  actualHours: number;
  allocatedHours: number;
}
