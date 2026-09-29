/** Matches ONEVO.Application.Features.Leave.Calendar.DTOs.Responses.* verbatim. */
export interface LeaveCalendarAbsenceResponse {
  requestId: string;
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  leaveTypeCategory: string;
  typeColorHex: string | null;
  status: string;
  isTentative: boolean;
  isPartialCancellationHistory: boolean;
  startDate: string;
  endDate: string;
  totalDays: number;
  halfDayPeriod: 'am' | 'pm' | null;
}

export interface LeaveCalendarHolidayResponse {
  date: string;
  name: string;
  legalEntityId: string | null;
  legalEntityName: string | null;
  source: string;
}

export interface LeaveCalendarDayResponse {
  date: string;
  dayOfWeek: string;
  absences: LeaveCalendarAbsenceResponse[];
  holidays: LeaveCalendarHolidayResponse[];
}

export interface LeaveCalendarMonthResponse {
  year: number;
  month: number;
  monthStart: string;
  monthEnd: string;
  includesTentativeBlocks: boolean;
  isEmpty: boolean;
  days: LeaveCalendarDayResponse[];
}

export interface LeaveCalendarFilter {
  year: number;
  month: number;
  departmentId?: string;
  includeTentative?: boolean;
}
