import { getInitials } from '../../../shared/utils/avatar.utils';

export interface EmployeeSummary {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export function buildInitials(fullName: string): string {
  return getInitials(fullName) || '?';
}
