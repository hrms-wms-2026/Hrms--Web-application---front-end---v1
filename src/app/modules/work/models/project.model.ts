export interface Project {
  id: string;
  name: string;
  identifier: string;
  categoryId: string;
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
}

export interface ProjectDetail extends Project {
  description: string | null;
  actualHours: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateProjectPayload {
  categoryId: string;
  name: string;
  identifier: string;
  description: string;
  startDate: string;
  targetDate: string;
  releaseDate: string;
  color: string;
  actualHours: number;
  defaultObjectiveAllocatedHours: number;
  logoFile: File | null;
}

export interface EditProjectPayload {
  name: string;
  description: string;
  categoryId: string;
  startDate: string;
  targetDate: string;
  color: string;
  actualHours: number;
}
