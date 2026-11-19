import { Sprint } from '../models/sprint.model';
import { SprintDto } from '../models/dto/sprint.dto';

export function toSprint(dto: SprintDto): Sprint {
  return {
    id: dto.id,
    projectId: dto.projectId,
    name: dto.name,
    goal: dto.goal,
    startDate: dto.startDate ? new Date(dto.startDate) : null,
    endDate: dto.endDate ? new Date(dto.endDate) : null,
    status: dto.status,
    completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    achievedAt: dto.achievedAt ? new Date(dto.achievedAt) : null,
    canManage: dto.canManage
  };
}
