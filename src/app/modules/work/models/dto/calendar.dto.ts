export interface ProjectCalendarEventLinkDto {
  eventId: string;
  eventName: string;
  eventColor: string;
  eventStartDate: string;
  eventEndDate: string;
  membership: 'whole' | 'partial';
  tasksInEventCount: number;
  taskTotalCount: number;
}

export interface ProjectCalendarModuleDto {
  objectiveId: string;
  projectId: string;
  parentObjectiveId: string | null;
  title: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isAchieved: boolean;
  canEdit: boolean;
  events: ProjectCalendarEventLinkDto[];
  /** Optional full-objective fields retained when the API supplies them. */
  description?: string | null;
  allocatedHours?: number;
  progressPercent?: number | null;
}

export interface ProjectCalendarEventBandDto {
  eventId: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string;
  canEdit: boolean;
}

export interface ProjectCalendarDto {
  modules: ProjectCalendarModuleDto[];
  bands: ProjectCalendarEventBandDto[];
}

export interface CalendarEventDto {
  id: string;
  projectId: string;
  name: string;
  color: string;
  status: 'active' | 'archived' | string;
  startDate: string;
  endDate: string;
  description?: string | null;
  createdByName?: string | null;
  objectiveIds: string[];
  taskIds: string[];
  createdAt?: string;
  archivedAt?: string | null;
}

export interface CalendarEventTaskSummaryDto {
  id: string;
  shortId: string;
  title: string;
  statusId: string;
  marksTaskComplete: boolean;
  /** 'not_started' | 'active' | 'done' - backs the Key Metrics breakdown (In Progress is
   *  specifically 'active', not "everything that isn't done", so not-started tasks don't
   *  get miscounted as in progress). */
  statusCategory: string;
  progressPercent: number;
  objectiveId: string;
  objectiveTitle: string;
}

export interface CalendarEventActivityEntryDto {
  id: string;
  action: 'created' | 'updated' | 'closed' | string;
  performedById: string;
  performedByName: string | null;
  performedAt: string;
  detailsJson: string;
}

export interface CreateCalendarEventRequestDto {
  name: string;
  color: string;
  startDate: string;
  endDate: string;
  objectiveIds: string[];
  taskIds: string[];
  description?: string;
}

export interface UpdateCalendarEventRequestDto {
  name?: string;
  color?: string;
  startDate?: string;
  endDate?: string;
  objectiveIds?: string[];
  taskIds?: string[];
  description?: string;
}

/** Module-bar drag still edits the Objective's own dates - unchanged. */
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
