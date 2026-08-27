export interface WorkPatternDay {
  date: string;
  focusMinutes: number;
  meetingMinutes: number;
  adminMinutes: number;
  idleMinutes: number;
}

export interface WorkPatternResponse {
  days: WorkPatternDay[];
}
