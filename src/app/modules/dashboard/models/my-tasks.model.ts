export interface MyTaskItem {
  taskId: string;
  shortId: string;
  title: string;
  dueDate: string;
  isOverdue: boolean;
  projectId: string;
  projectName: string;
  objectiveId: string;
  priority: string;
}

export interface MyTasksResponse {
  tasks: MyTaskItem[];
}
