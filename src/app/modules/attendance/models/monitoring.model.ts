export type MonitoringScopeType = 'department' | 'position' | 'role';

export interface MonitoringFeatureToggles {
  activityMonitoring: boolean;
  applicationTracking: boolean;
  documentTracking: boolean;
  communicationTracking: boolean;
  screenshotCapture: boolean;
  autoScreenshotCapture: boolean;
  meetingDetection: boolean;
  deviceTracking: boolean;
  workLocationVerification: boolean;
  identityVerification: boolean;
  biometric: boolean;
  idleThresholdMinutes: number;
  updatedAt: string | null;
}

export interface MonitoringPolicyOverride {
  id: string;
  scopeType: MonitoringScopeType;
  scopeId: string;
  targetName: string;
  activityMonitoring: boolean | null;
  applicationTracking: boolean | null;
  documentTracking: boolean | null;
  communicationTracking: boolean | null;
  screenshotCapture: boolean | null;
  autoScreenshotCapture: boolean | null;
  meetingDetection: boolean | null;
  deviceTracking: boolean | null;
  workLocationVerification: boolean | null;
  identityVerification: boolean | null;
  biometric: boolean | null;
  idleThresholdMinutes: number | null;
  overrideReason: string;
  updatedAt: string;
}

export interface MonitoringPolicyConfiguration {
  companyDefault: MonitoringFeatureToggles;
  overrides: readonly MonitoringPolicyOverride[];
  /** False when the caller has no active company/legal-entity context - department and
   * position overrides cannot be attributed to a company in that state, so the backend omits
   * them (role overrides and the tenant-wide company default are still returned). */
  hasActiveCompanyContext: boolean;
}

export type MonitoringFeatureTogglesRequest = Omit<MonitoringFeatureToggles, 'updatedAt'>;
export type MonitoringPolicyOverrideRequest = {
  activityMonitoring: boolean | null;
  applicationTracking: boolean | null;
  documentTracking: boolean | null;
  communicationTracking: boolean | null;
  screenshotCapture: boolean | null;
  autoScreenshotCapture: boolean | null;
  meetingDetection: boolean | null;
  deviceTracking: boolean | null;
  workLocationVerification: boolean | null;
  identityVerification: boolean | null;
  biometric: boolean | null;
  idleThresholdMinutes: number | null;
  overrideReason: string | null;
};

export const MONITORING_SCOPE_LABELS: Record<MonitoringScopeType, string> = {
  department: 'Departments',
  position: 'Positions',
  role: 'Roles'
};
