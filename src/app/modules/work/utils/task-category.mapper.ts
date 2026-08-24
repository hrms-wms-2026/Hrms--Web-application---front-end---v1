import { TaskCategoryDto } from '../models/dto/task-category.dto';
import { TaskCategoryColumn } from '../models/task-category.model';

export function toTaskCategoryColumn(dto: TaskCategoryDto): TaskCategoryColumn {
  return {
    id: dto.id,
    name: dto.name,
    displayOrder: dto.displayOrder
  };
}

