export interface WorkPatternDay {
  date: string;
  focusMinutes: number;
  meetingMinutes: number;
  otherActiveMinutes: number;
  idleMinutes: number;
  productiveMinutes: number;
}

export interface WorkPatternResponse {
  days: WorkPatternDay[];
}
