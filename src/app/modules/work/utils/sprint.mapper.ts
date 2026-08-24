import { Sprint } from '../models/sprint.model';
import { SprintDto } from '../models/dto/sprint.dto';

export function toSprint(dto: SprintDto): Sprint {
  return {
    id: dto.id,
    objectiveId: dto.objectiveId,
    name: dto.name,
    startDate: new Date(dto.startDate),
    endDate: new Date(dto.endDate),
    status: dto.status,
    completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    achievedAt: dto.achievedAt ? new Date(dto.achievedAt) : null
  };
}
