export interface TaskCategoryDto {
  id: string;
  name: string;
  displayOrder: number;
}

export interface CreateTaskCategoryRequestDto {
  name: string;
  displayOrder: number;
}

export interface EditTaskCategoryRequestDto {
  name: string;
  displayOrder: number;
}

export interface ReorderTaskCategoriesRequestDto {
  categoryId: string;
  displayOrder: number;
}

