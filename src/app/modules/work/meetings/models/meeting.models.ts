// Contract types for /api/v1/meetings (backend docs/api/meetings-v1.md). JSON is camelCase; times are UTC ISO strings.

export type MeetingScope = 'this' | 'following' | 'all';
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingRole = 'organizer' | 'attendee';
export type MeetingPlatform = 'microsoft_teams' | 'zoom';
export type MeetingResponseStatus = 'pending' | 'accepted' | 'rejected';

export interface CreateMeetingRequest {
  projectId: string | null;
  objectiveId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  isPrivate: boolean;
  start: string;
  durationMinutes: number;
  isAllDay: boolean;
  timezone: string;
  recurrenceRule: string | null;
  participantEmployeeIds: string[];
  guestEmails: string[];
  platform: MeetingPlatform | null;
}

export interface MeetingSkippedAttendee { employeeId: string; reason: string; }

export interface MeetingCreatedResponse {
  outcome: 'created' | 'requested';
  seriesId: string | null;
  firstOccurrenceTaskId: string | null;
  approvalRequestId: string | null;
  skipped: MeetingSkippedAttendee[];
}

export interface MeetingPlacement { projectId: string | null; projectName: string | null; objectiveId: string | null; moduleTitle: string | null; isOffice: boolean; }
export interface MeetingOrganizer { employeeId: string; name: string; }

export interface MeetingAttendee {
  kind: 'employee' | 'guest';
  employeeId: string | null;
  name: string | null;
  email: string | null;
  response: MeetingResponseStatus | null;
  responseReason: string | null;
  source: 'series' | 'occurrence';
}

export interface MeetingOccurrenceResponse {
  taskId: string;
  shortId: string;
  seriesId: string;
  originalStart: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  timezone: string;
  title: string;
  description: string | null;
  location: string | null;
  isPrivate: boolean;
  status: MeetingStatus;
  isDetached: boolean;
  revision: number;
  seriesRevision: number;
  recurrenceRule: string | null;
  placement: MeetingPlacement;
  organizer: MeetingOrganizer;
  myRole: MeetingRole;
  myResponse: MeetingResponseStatus | null;
  attendees: MeetingAttendee[];
  canEdit: boolean;
}

export interface MeetingListItem {
  taskId: string;
  shortId: string;
  seriesId: string;
  originalStart: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  title: string;
  status: MeetingStatus;
  isPrivate: boolean;
  projectId: string | null;
  objectiveId: string | null;
  myRole: MeetingRole;
  myResponse: MeetingResponseStatus | null;
}

export interface MeetingSeriesResponse {
  seriesId: string;
  title: string;
  description: string | null;
  location: string | null;
  isPrivate: boolean;
  dtStart: string;
  durationMinutes: number;
  isAllDay: boolean;
  timezone: string;
  recurrenceRule: string | null;
  revision: number;
  placement: MeetingPlacement;
  organizer: MeetingOrganizer;
  myRole: MeetingRole;
  attendees: MeetingAttendee[];
  upcomingOccurrences: MeetingListItem[];
}

/** Only the fields being changed; revision = the occurrence revision for "this", the series revision otherwise. */
export interface EditMeetingRequest {
  scope: MeetingScope;
  revision: number;
  title?: string;
  description?: string | null;
  location?: string | null;
  isPrivate?: boolean;
  start?: string;
  durationMinutes?: number;
  isAllDay?: boolean;
  timezone?: string;
  recurrenceRule?: string | null;
}

export interface MeetingEditResponse { seriesId: string; occurrenceTaskId: string; split: boolean; }

export interface MoveMeetingRequest { scope: 'this' | 'following'; projectId: string; objectiveId: string; }
export interface MeetingMoveResponse { outcome: 'moved' | 'requested'; seriesId: string; approvalRequestId: string | null; }
export interface MeetingAttendeesRequest { employeeIds: string[]; guestEmails: string[]; }
export interface MeetingAttendeesResponse { added: number; skipped: MeetingSkippedAttendee[]; }
export interface RespondToMeetingRequest { status: 'accepted' | 'rejected'; reason: string | null; originalStart: string | null; }

export type MeetingLinkStatus = 'provisioning' | 'active' | 'provisioning_unknown' | 'failed' | 'unresolved' | 'cancelled' | 'not_connected';
export interface MeetingLinkRequest { platform: MeetingPlatform; regenerate: boolean; }
export interface MeetingLinkResponse {
  linkId: string;
  provider: MeetingPlatform;
  status: MeetingLinkStatus;
  joinUrl: string | null;
  organizerJoinUrl: string | null;
  failureReason: string | null;
  generation: number;
  releasePending: boolean;
}
/** Attendees get joinUrl only; the organizer also gets the link's state. */
export interface MeetingSeriesLinkResponse { joinUrl: string | null; link?: MeetingLinkResponse | null; }

export type MeetingAttendanceSyncStatus = 'pending' | 'provisional' | 'synced' | 'attendance_unavailable' | 'sync_failed' | 'not_applicable';
export type MeetingAttendanceDisplay = 'Unknown' | 'Recorded' | 'Not applicable';
export type MeetingAttendanceOutcome = 'joined' | 'no_join_recorded' | 'unknown';

export interface MeetingAttendanceRow {
  kind: 'employee' | 'guest';
  employeeId: string | null;
  email: string | null;
  displayName: string;
  attendedSeconds: number | null;
  outcome: MeetingAttendanceOutcome;
}
export interface MeetingUnmatchedSpan { start: string; end: string | null; }
export interface MeetingAttendanceResponse {
  status: MeetingAttendanceSyncStatus;
  display: MeetingAttendanceDisplay;
  rows: MeetingAttendanceRow[];
  /** Organizer only; null for attendees. */
  unmatched: MeetingUnmatchedSpan[] | null;
}
export interface MeetingAttendanceStatusResponse {
  status: MeetingAttendanceSyncStatus;
  nextCheckAt: string | null;
  finalizedAt: string | null;
  lastError: 'provider_error' | 'missing_scope' | 'not_connected' | 'reauth_required' | null;
}

/** Backend MeetingActionItemContracts.MeetingActionItemView: a linked task the caller may see. */
export interface MeetingActionItemView {
  taskId: string;
  shortId: string;
  title: string;
  statusName: string;
  objectiveId: string;
  assigneeEmployeeId: string | null;
  linkedByEmployeeId: string;
  linkedAt: string;
}

export interface MeetingBulkPreviewRequest {
  projectId: string | null;
  objectiveId: string | null;
  departmentIds: string[];
  managerEmployeeIds: string[];
  employeeIds: string[];
  seriesId: string | null;
  platform: MeetingPlatform | null;
}
export interface MeetingBulkPerson { employeeId: string; name: string; email: string | null; departmentName: string | null; }
export interface MeetingBulkPreviewResponse {
  people: MeetingBulkPerson[];
  selected: number;
  duplicatesRemoved: number;
  inactiveExcluded: number;
  alreadyInvited: number;
  capacityWarning: string | null;
}

export interface EmployeeMeetingAttendanceItem {
  occurrenceTaskId: string;
  startAt: string;
  endAt: string;
  /** "Private meeting" for a private occurrence seen by a manager. */
  title: string;
  organizerName: string | null;
  status: MeetingAttendanceSyncStatus;
  display: MeetingAttendanceDisplay;
  outcome: MeetingAttendanceOutcome;
  attendedSeconds: number | null;
}
export interface EmployeeMeetingAttendanceResponse { items: EmployeeMeetingAttendanceItem[]; }

/** What the approver of a meeting.create / meeting.move request sees (spec D5), frozen when it was submitted. */
export interface MeetingApprovalSnapshot {
  title: string;
  description: string | null;
  start: string;
  durationMinutes: number;
  timezone: string;
  recurrenceSummary: string;
  organizerName: string;
  modulePath: string;
  participantNames: string[];
  guestEmails: string[];
  platform: MeetingPlatform | null;
}
