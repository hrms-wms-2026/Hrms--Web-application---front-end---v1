export type ProfileSubTabId = 'personal' | 'emergency' | 'job' | 'documents' | 'payroll' | 'security';

export interface ProfileSubTab {
  readonly id: ProfileSubTabId;
  readonly label: string;
}

export const PROFILE_SUB_TABS: readonly ProfileSubTab[] = [
  { id: 'personal', label: 'Personal Information' },
  { id: 'emergency', label: 'Emergency Contact & Dependents' },
  { id: 'job', label: 'Job Information' },
  { id: 'documents', label: 'My Documents' },
  { id: 'payroll', label: 'Payroll & Statutory' },
  { id: 'security', label: 'Security Settings' }
];

export function isProfileSubTabId(value: string): value is ProfileSubTabId {
  return PROFILE_SUB_TABS.some((tab) => tab.id === value);
}
