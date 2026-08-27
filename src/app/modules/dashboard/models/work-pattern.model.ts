export interface WorkPatternDay {
  date: string;
  focusMinutes: number;
  meetingMinutes: number;
  adminMinutes: number;
}

export interface WorkPatternResponse {
  days: WorkPatternDay[];
}
