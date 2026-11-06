export interface TaskCategoryDto {
  id: string;
  name: string;
  displayOrder: number;
  systemKey?: string | null;
  isSystem?: boolean;
  kind?: string;
  icon?: string | null;
}

export interface CreateTaskCategoryRequestDto {
  name: string;
  displayOrder: number;
  /** Required: one of the user kinds (task, bug, story, feature, testing); the API never infers it from the name. */
  kind: string;
  icon?: string;
}

export interface EditTaskCategoryRequestDto {
  name: string;
  displayOrder: number;
  /** Omitted: unchanged. */
  kind?: string;
  /** Omitted: unchanged. Empty: cleared. */
  icon?: string;
}

export interface ReorderTaskCategoriesRequestDto {
  categoryId: string;
  displayOrder: number;
}

