/**
 * Response from POST /api/v1/monitoring/activation/generate
 * (ActivationCodeResponseDto in ONEVO.Application/Features/Monitoring/TrayActivation).
 * Field names are snake_case exactly as the API returns them — there is no
 * case-conversion interceptor in this app (confirmed: only auth/csrf/correlation/error
 * interceptors exist in src/app/core/interceptors).
 */
export interface ActivationCodeResponse {
  readonly code: string;
  readonly expires_in_seconds: number;
}
