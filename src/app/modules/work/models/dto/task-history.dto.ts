export interface TaskEditEntryDetailsDto {
  logId: string;
  source: 'direct' | 'approved_request';
  editRequestId: string | null;
  oldValuesJson: string;
  newValuesJson: string;
  reason: string | null;
}

export interface TaskStatusChangeEntryDetailsDto {
  fromStatusId: string;
  toStatusId: string;
}

export interface TaskClockSessionEntryDetailsDto {
  sessionId: string;
  clockInAt: string;
  clockOutAt: string | null;
  durationMinutes: number | null;
  sessionReason: string | null;
  pushedPercent: number | null;
  previousPercent: number | null;
  percentageLogId: string | null;
  percentageReason: string | null;
}

export interface TaskPercentageChangeEntryDetailsDto {
  logId: string;
  previousPercent: number;
  newPercent: number;
  source: 'push' | 'manual_edit' | 'status_change';
  reason: string | null;
}

export interface TaskHistoryEntryDto {
  type: 'edit' | 'status_change' | 'clock_session' | 'percentage_change';
  occurredAt: string;
  employeeId: string;
  employeeName: string;
  edit: TaskEditEntryDetailsDto | null;
  statusChange: TaskStatusChangeEntryDetailsDto | null;
  clockSession: TaskClockSessionEntryDetailsDto | null;
  percentageChange: TaskPercentageChangeEntryDetailsDto | null;
}
