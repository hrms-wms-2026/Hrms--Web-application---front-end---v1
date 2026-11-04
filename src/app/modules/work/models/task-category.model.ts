export interface TaskCategoryColumn {
  id: string;
  name: string;
  displayOrder: number;
  systemKey?: string | null;
  isSystem?: boolean;
  /** The category's fixed type (task, bug, story, …); absent from an older API, read as task. */
  kind?: string;
}

