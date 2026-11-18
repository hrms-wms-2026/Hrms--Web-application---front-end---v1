import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { AuthApiService } from '../data-access/auth-api.service';
import type { AuthResponseDto } from '../models/dto/auth-response.dto';
import type { LoginRequestDto } from '../models/dto/login-request.dto';
import {
  LoginResultDto,
  WorkspaceSelectionRequiredDto,
  isWorkspaceSelectionRequired,
} from '../models/dto/workspace-selection.dto';
import { safeServerDetail } from '../../services/error-handler.service';
import { UNREACHABLE_MESSAGE } from './auth-messages';

/**
 * Password login, Google sign-in and workspace selection, loaded on demand by AuthStore with
 * `import()` so this code stays out of the initial bundle: only the root-host login page runs it.
 */

const SELECTION_EXPIRED_MESSAGE = 'That sign-in has expired. Please sign in again.';
const GOOGLE_FAILED_MESSAGE = 'Google sign-in failed. Please try again.';
const GOOGLE_NO_ACCESS_MESSAGE =
  'This Google account does not have access to Crownus. Ask your administrator for an invitation.';

/** What a flow may read and change in AuthStore. */
export interface LoginFlowContext {
  api: AuthApiService;
  workspaceSelection(): WorkspaceSelectionRequiredDto | null;
  patch(state: {
    loading?: boolean;
    error?: string | null;
    workspaceSelection?: WorkspaceSelectionRequiredDto | null;
  }): void;
  applyAuthResponse(dto: AuthResponseDto): void;
}

/**
 * Shared by password and Google login: a 202 parks the server's workspace choices in memory;
 * anything else is a normal auth response (legal / continue_url).
 */
function applyLoginResult(ctx: LoginFlowContext, body: LoginResultDto): void {
  if (isWorkspaceSelectionRequired(body)) {
    ctx.patch({ workspaceSelection: body, loading: false });
    return;
  }
  ctx.applyAuthResponse(body);
}

export async function login(ctx: LoginFlowContext, payload: LoginRequestDto): Promise<void> {
  ctx.patch({ loading: true, error: null, workspaceSelection: null });
  try {
    applyLoginResult(ctx, await firstValueFrom(ctx.api.login(payload)));
  } catch (err) {
    // status 0 = the request never reached the API, so the credentials were never checked.
    const unreachable = err instanceof HttpErrorResponse && err.status === 0;
    ctx.patch({
      loading: false,
      error: unreachable
        ? UNREACHABLE_MESSAGE
        : (safeServerDetail(err) ?? 'Invalid email or password.'),
    });
    throw err;
  }
}

/**
 * Google sign-in shows only its own two messages, never the password-login text: the backend
 * answers 403 `no_access` when the Google account has no access, and 401 `google_auth_failed`
 * when Google itself failed. Anything else is treated as a Google failure.
 */
function googleLoginErrorMessage(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) return GOOGLE_FAILED_MESSAGE;
  if (err.status === 0) return UNREACHABLE_MESSAGE;
  const code = (err.error as { code?: unknown } | null)?.code;
  if (code === 'no_access' || err.status === 403) return GOOGLE_NO_ACCESS_MESSAGE;
  return GOOGLE_FAILED_MESSAGE;
}

/** The public Google Client ID, or null when Google sign-in is disabled or blank. */
export async function loadGoogleClientId(api: AuthApiService): Promise<string | null> {
  const config = await firstValueFrom(api.getGoogleSsoConfig());
  const clientId = config.enabled ? config.clientId?.trim() : '';
  return clientId ? clientId : null;
}

/** Posts the Google ID token once and keeps no copy of it. */
export async function loginWithGoogle(ctx: LoginFlowContext, idToken: string): Promise<void> {
  ctx.patch({ loading: true, error: null, workspaceSelection: null });
  try {
    applyLoginResult(ctx, await firstValueFrom(ctx.api.loginWithGoogle(idToken)));
  } catch (err) {
    ctx.patch({ loading: false, error: googleLoginErrorMessage(err) });
    throw err;
  }
}

export async function selectWorkspace(ctx: LoginFlowContext, slug: string): Promise<void> {
  const selection = ctx.workspaceSelection();
  if (!selection) {
    ctx.patch({ error: SELECTION_EXPIRED_MESSAGE });
    throw new Error(SELECTION_EXPIRED_MESSAGE);
  }
  // Only a server-offered workspace may be submitted.
  if (!selection.workspaces.some((w) => w.slug === slug)) {
    throw new Error('Unknown workspace.');
  }
  ctx.patch({ loading: true, error: null });
  try {
    ctx.applyAuthResponse(
      await firstValueFrom(
        ctx.api.selectWorkspace({ login_challenge: selection.login_challenge, workspace: slug }),
      ),
    );
  } catch (err) {
    // The challenge is short-lived and single-use server-side; any failure means start over.
    const unreachable = err instanceof HttpErrorResponse && err.status === 0;
    ctx.patch({
      loading: false,
      workspaceSelection: null,
      error: unreachable ? UNREACHABLE_MESSAGE : SELECTION_EXPIRED_MESSAGE,
    });
    throw err;
  }
}
