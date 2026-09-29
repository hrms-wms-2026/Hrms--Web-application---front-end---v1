/** An advisory planning warning from the project monitor. It never blocks saving. */
export interface MonitorWarningDto {
  code: string;
  message: string;
  employeeId?: string | null;
}

export interface ModuleCapacityCheckRequestDto {
  moduleId?: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  memberEmployeeIds?: string[];
}

export interface ModuleCapacityCheckDto {
  dailyHours: number;
  workingDays: number;
  memberCount: number;
  capacityHours: number;
  allocatedHours: number;
  warnings: MonitorWarningDto[];
}

export interface TaskLoadCheckRequestDto {
  taskId?: string | null;
  assigneeEmployeeIds: string[];
  dueDate: string | null;
  estimatedHours: number | null;
}

export interface TaskLoadCheckDto {
  warnings: MonitorWarningDto[];
}

export type MonitorTargetType = 'module' | 'sprint' | 'task';

/** An open problem the hourly project monitor found on a module, sprint or task. */
export interface MonitorAlertDto {
  id: string;
  targetType: MonitorTargetType;
  targetId: string;
  targetTitle: string;
  ruleCode: string;
  subjectEmployeeId: string | null;
  message: string;
  firstDetectedAt: string;
}
