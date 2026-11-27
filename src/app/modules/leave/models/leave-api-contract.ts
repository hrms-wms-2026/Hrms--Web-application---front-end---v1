import type { ApiSchema, Assert, MatchesContract } from '../../../shared/api-types/api-schema';
import type {
  ApproveLeaveRequestRequest,
  ChangeLeaveDecisionRequest,
  RejectLeaveRequestRequest,
} from './leave-approval.model';
import type { CreateLeaveHolidayRequest } from './leave-calendar.model';
import type {
  AdjustEntitlementRequest,
  CreateManualEntitlementRequest,
  GenerateEntitlementsRequest,
  RecalculateEntitlementRequest,
} from './leave-entitlement.model';
import type {
  AddLeavePolicyVersionRequest,
  CreateLeavePolicyRequest,
  UpdateLeavePolicyDetailsRequest,
} from './leave-policy.model';
import type {
  CancelLeaveRequestRequest,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest,
} from './leave-request.model';
import type { CreateLeaveTypeRequest, UpdateLeaveTypeRequest } from './leave-type.model';

/**
 * Compile-time check that every Leave request DTO still matches the backend contract
 * (`npm run api:types`). If the backend renames, removes, adds or retypes a field (at any nesting level), the build
 * fails here. Response DTOs are not checked: the backend Swagger has no response schemas yet
 * (see docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md).
 */
export type LeaveRequestContracts = [
  Assert<
    MatchesContract<
      SubmitLeaveRequestRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestRequest'>
    >
  >,
  Assert<
    MatchesContract<
      SubmitLeaveRequestOnBehalfRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestOnBehalfRequest'>
    >
  >,
  Assert<
    MatchesContract<
      CancelLeaveRequestRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>
    >
  >,
  Assert<
    MatchesContract<
      ChangeLeaveDecisionRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.ChangeLeaveDecisionRequest'>
    >
  >,
  Assert<
    MatchesContract<
      ApproveLeaveRequestRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.ApproveLeaveRequestRequest'>
    >
  >,
  Assert<
    MatchesContract<
      RejectLeaveRequestRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.RejectLeaveRequestRequest'>
    >
  >,
  Assert<
    MatchesContract<
      CreateLeaveHolidayRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Holidays.CreateLeaveHolidayRequest'>
    >
  >,
  Assert<
    MatchesContract<
      GenerateEntitlementsRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.GenerateEntitlementsRequest'>
    >
  >,
  Assert<
    MatchesContract<
      CreateManualEntitlementRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.CreateManualEntitlementRequest'>
    >
  >,
  Assert<
    MatchesContract<
      AdjustEntitlementRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.AdjustEntitlementRequest'>
    >
  >,
  Assert<
    MatchesContract<
      RecalculateEntitlementRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.RecalculateEntitlementRequest'>
    >
  >,
  Assert<
    MatchesContract<
      CreateLeavePolicyRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Policies.CreateLeavePolicyRequest'>
    >
  >,
  Assert<
    MatchesContract<
      AddLeavePolicyVersionRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Policies.AddLeavePolicyVersionRequest'>
    >
  >,
  Assert<
    MatchesContract<
      UpdateLeavePolicyDetailsRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Policies.UpdateLeavePolicyDetailsRequest'>
    >
  >,
  Assert<
    MatchesContract<
      CreateLeaveTypeRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest'>
    >
  >,
  Assert<
    MatchesContract<
      UpdateLeaveTypeRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Types.UpdateLeaveTypeRequest'>
    >
  >,
];
