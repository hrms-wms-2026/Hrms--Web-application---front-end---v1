export interface TaskCategoryDto {
  id: string;
  name: string;
  displayOrder: number;
  systemKey?: string | null;
  isSystem?: boolean;
  kind?: string;
}

export interface CreateTaskCategoryRequestDto {
  name: string;
  displayOrder: number;
  /** Omitted: the API infers it from the name. */
  kind?: string;
}

export interface EditTaskCategoryRequestDto {
  name: string;
  displayOrder: number;
  /** Omitted: unchanged. */
  kind?: string;
}

export interface ReorderTaskCategoriesRequestDto {
  categoryId: string;
  displayOrder: number;
}

