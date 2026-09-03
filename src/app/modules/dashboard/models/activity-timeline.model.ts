export interface ActivityTimelineSegment {
  startedAt: string;
  endedAt: string;
  type: 'focus' | 'idle';
}

export interface ActivityTimelineResponse {
  date: string;
  segments: ActivityTimelineSegment[];
}
