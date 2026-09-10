import { describe, it, expect } from 'vitest';
import { EmployeeListItemResponse } from '../models/employee.model';
import {
  avatarInitials,
  attendanceWarningLabel,
  attendanceSeverityClass,
  attendanceAttentionLabel,
  attendanceStatusLabel,
  breakOverageLabel
} from './employee-view.utils';

describe('employee-view.utils', () => {
  const baseEmployee: EmployeeListItemResponse = {
    id: 'emp-1',
    employeeNumber: 'E-001',
    fullName: 'Ada Lovelace',
    email: 'ada@test.dev',
    departmentId: 'd-1',
    departmentName: 'Engineering',
    positionId: 'p-1',
    positionName: 'Software Engineer',
    legalEntityId: 'le-1',
    legalEntityName: 'Acme Corp',
    employmentTypeLabel: 'Full-time',
    status: 'active',
    reportingManagerId: 'mgr-1',
    reportingManagerName: 'Grace Hopper'
  };

  describe('avatarInitials', () => {
    it('returns two letters for two words', () => {
      expect(avatarInitials('Ada Lovelace')).toBe('AL');
    });

    it('returns first two letters for single word', () => {
      expect(avatarInitials('Cher')).toBe('CH');
    });

    it('returns E for empty string', () => {
      expect(avatarInitials('')).toBe('E');
    });
  });

  describe('attendanceWarningLabel', () => {
    it('returns null when showNotClockedInWarning is false', () => {
      expect(attendanceWarningLabel(baseEmployee)).toBeNull();
    });

    it('returns warningLabel when present and showNotClockedInWarning is true', () => {
      const emp: EmployeeListItemResponse = {
        ...baseEmployee,
        attendanceSummary: {
          showNotClockedInWarning: true,
          shouldHaveClockedIn: true,
          hasClockedInToday: false,
          workDate: '2026-09-01',
          timezone: 'UTC',
          scheduledStartTime: '09:00',
          warningLabel: 'Arrived late'
        }
      };
      expect(attendanceWarningLabel(emp)).toBe('Arrived late');
    });
  });

  describe('attendanceSeverityClass', () => {
    it('returns neutral by default', () => {
      expect(attendanceSeverityClass(baseEmployee)).toBe('emp-attention--neutral');
    });

    it('returns critical when severity is critical', () => {
      const emp: EmployeeListItemResponse = {
        ...baseEmployee,
        attendanceSummary: {
          showNotClockedInWarning: false,
          shouldHaveClockedIn: true,
          hasClockedInToday: true,
          workDate: '2026-09-01',
          timezone: 'UTC',
          scheduledStartTime: '09:00',
          warningLabel: null,
          attentionSeverity: 'critical'
        }
      };
      expect(attendanceSeverityClass(emp)).toBe('emp-attention--critical');
    });
  });

  describe('breakOverageLabel', () => {
    it('returns formatted label when over allowance', () => {
      const emp: EmployeeListItemResponse = {
        ...baseEmployee,
        attendanceSummary: {
          showNotClockedInWarning: false,
          shouldHaveClockedIn: true,
          hasClockedInToday: true,
          workDate: '2026-09-01',
          timezone: 'UTC',
          scheduledStartTime: '09:00',
          warningLabel: null,
          isOverBreakAllowance: true,
          breakOverageMinutes: 20
        }
      };
      expect(breakOverageLabel(emp)).toBe('Break exceeded by 20 min');
    });
  });
});
