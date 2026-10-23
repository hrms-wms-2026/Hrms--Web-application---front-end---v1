import { LeavePolicyRules } from '../models/leave-policy.model';

/** 8 h / month, carry all, right away, 1 h minimum, any one approver. */
export function sampleRules(): LeavePolicyRules {
  return {
    amountHours: 8, amountPeriod: 'month', carryForwardCapHours: null, carryForwardExpiryMonths: null,
    eligibleFrom: 'immediately', eligibleAfterMonths: null, minimumNoticeDays: 0, minRequestHours: 1,
    maxRequestHours: null, maxTeamAbsencePercent: null, approvalMode: 'any_one', blackouts: []
  };
}
