export interface TeamTodayLeave {
  leaveTypeName: string;
  endsOn: string;
}

export interface TeamTodayMember {
  employeeId: string;
  displayName: string;
  avatarFileId: string | null;
  positionTitle: string | null;
  status: string;
  statusLabel: string;
  isLate: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  attentionType: string | null;
  attentionLabel: string | null;
  attentionSeverity: string | null;
  leave: TeamTodayLeave | null;
}

export interface TeamTodaySummary {
  total: number;
  working: number;
  onBreak: number;
  clockedOut: number;
  late: number;
  absent: number;
  notStarted: number;
  onLeave: number;
  notScheduled: number;
  needsAttention: number;
}

export interface TeamTodayResponse {
  workDate: string;
  timezone: string;
  legalEntityId: string;
  summary: TeamTodaySummary;
  members: TeamTodayMember[];
  totalMembers: number;
}
