export interface ProjectCalendarItemDto {
  objectiveId: string;
  projectId: string;
  parentObjectiveId: string | null;
  title: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isAchieved: boolean;
  canEdit: boolean;
  calendarEventId: string | null;
  calendarEventColor: string | null;
  /** Optional full-objective fields retained when the API supplies them. */
  description?: string | null;
  allocatedHours?: number;
}

export interface CalendarEventDto {
  id: string;
  projectId: string;
  name: string;
  color: string;
  status: 'active' | 'archived' | string;
  objectiveIds: string[];
  createdAt?: string;
  archivedAt?: string | null;
}

export interface CreateCalendarEventRequestDto {
  name: string;
  color: string;
  objectiveIds: string[];
}

export interface UpdateCalendarEventRequestDto {
  name?: string;
  color?: string;
  objectiveIds?: string[];
}

export interface CalendarDateChange {
  objectiveId: string;
  startDate: string;
  endDate: string;
}

export interface CalendarDateSaveResult {
  success: boolean;
  applied: boolean;
  pendingApproval: boolean;
}
