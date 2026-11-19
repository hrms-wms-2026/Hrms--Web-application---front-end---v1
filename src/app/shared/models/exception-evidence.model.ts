/** Exception case evidence and labels, shared by the Inbox exception renderer and anything else that shows a case.
 *  ExceptionType names match the backend enum (serialized as strings). */
export type ExceptionAlertType = 'SustainedLowActivity' | 'AttendanceIrregularity' | 'UnusualActivityPattern' | 'IdentityAnomaly';
/** Notification relatedEntityType the backend stamps on exception alerts. */
export const EXCEPTION_ALERT_ENTITY_TYPE = 'monitoring_exception';

export const EXCEPTION_ALERT_TYPE_LABELS: Record<ExceptionAlertType, string> = {
  SustainedLowActivity: 'Sustained low activity',
  AttendanceIrregularity: 'Attendance irregularity',
  UnusualActivityPattern: 'Unusual activity pattern',
  IdentityAnomaly: 'Identity check'
};

/** GET /api/v1/monitoring/exceptions/{id}/evidence - ExceptionEvidenceDto. */
export interface ExceptionEvidenceResponse {
  readonly exceptionId: string;
  readonly type: ExceptionAlertType;
  /** yyyy-MM-dd, the company-local day the case is about. */
  readonly workDate: string;
  readonly timezone: string;
  readonly attendance: AttendanceEvidence | null;
  readonly identity: IdentityEvidence | null;
  readonly faceChecks: readonly FaceCheckEvidence[];
  readonly checkInScans: readonly CheckInScanEvidence[];
  /** Null when the viewer lacks monitoring:read (see activityHidden). */
  readonly deviceActivity: DeviceActivityEvidence | null;
  /** Only for the nightly multi-day alerts. */
  readonly pattern: PatternEvidence | null;
  /** Device timeline and daily activity figures need monitoring:read; the alert's reason stays visible. */
  readonly activityHidden: boolean;
}

export type DeviceActivityState = 'active' | 'idle' | 'offline';

export interface DeviceActivityEvidence {
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  readonly activeMinutes: number;
  readonly idleMinutes: number;
  readonly offlineMinutes: number;
  /** More than one device reporting on the same day is worth a look. */
  readonly deviceIds: readonly string[];
  readonly segments: readonly DeviceActivitySegment[];
  readonly truncated: boolean;
}

export interface DeviceActivitySegment {
  readonly start: string;
  readonly end: string;
  readonly state: DeviceActivityState;
}

export interface PatternEvidence {
  readonly from: string;
  readonly to: string;
  readonly days: readonly DailyPatternPoint[];
  readonly measures: readonly PatternMeasure[];
  /** Older case: figures recomputed now, may differ from what was flagged. */
  readonly measuresRecalculated: boolean;
}

export interface DailyPatternPoint {
  readonly date: string;
  readonly activityScore: number | null;
  readonly activeMinutes: number | null;
  readonly idleMinutes: number | null;
  readonly workedMinutes: number | null;
  readonly attendanceStatus: string | null;
  /** One of the days the detection rule itself looked at. */
  readonly inRule: boolean;
}

export interface PatternMeasure {
  readonly label: string;
  readonly value: number;
  readonly unit: 'score' | 'minutes' | 'days' | 'points' | string;
}

export interface AttendanceEvidence {
  readonly clockInAt: string | null;
  readonly clockOutAt: string | null;
  readonly source: string | null;
  readonly status: string;
}

export interface IdentityEvidence {
  readonly source: 'face_check_override' | 'check_in_scan' | null;
  readonly occurredAt: string | null;
  readonly purpose: string | null;
  readonly similarityScore: number | null;
  readonly reasons: readonly string[];
  readonly deviceRegistrationId: string | null;
  /** Short-lived signed URL of the photo that raised the case - refetch evidence, never cache it. */
  readonly photoUrl: string | null;
  readonly photoUrlExpiresAt: string | null;
  /** A photo was kept but couldn't be served right now - not the same as "no photo kept". */
  readonly photoUnavailable: boolean;
}

export interface FaceCheckEvidence {
  readonly id: string;
  readonly at: string;
  readonly purpose: string;
  readonly outcome: string;
  readonly failureReason: string | null;
  readonly similarityScore: number | null;
  /** Short-lived signed URL of the photo taken at this try (failed tries keep theirs). */
  readonly photoUrl?: string | null;
  /** A photo was kept but couldn't be served right now. */
  readonly photoUnavailable?: boolean;
}

export interface CheckInScanEvidence {
  readonly checkInId: string;
  readonly at: string;
  readonly scanStatus: string | null;
  readonly similarityScore: number | null;
  readonly deviceRegistrationId: string;
  readonly deviceSerialNumber: string | null;
}

/** Same wording as the backend's face-check reasons. */
const FACE_REASON_LABELS: Record<string, string> = {
  not_matched: 'Face did not match',
  no_face_detected: 'No face detected',
  multiple_faces: 'More than one person',
  face_not_visible: 'Face not fully visible',
  poor_lighting: 'Poor lighting',
  sunglasses_or_mask: 'Sunglasses or mask',
  glasses_glare: 'Glare on glasses',
  eyes_closed: 'Eyes closed',
  verification_failed: 'Face check service unavailable',
  no_reference_photo: 'No enrolled face'
};

export function faceReasonLabel(reason: string | null): string {
  if (!reason) return '—';
  return FACE_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

const FACE_OUTCOME_LABELS: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  overridden: 'Let through for review',
  verified: 'Matched',
  not_matched: 'Did not match',
  no_reference_photo: 'No enrolled face',
  pending_scan: 'Not checked yet',
  available: 'Not checked'
};

export function faceOutcomeLabel(value: string | null): string {
  if (!value) return '—';
  return FACE_OUTCOME_LABELS[value.toLowerCase()] ?? value.replace(/_/g, ' ');
}
