import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../data-access/auth-api.service';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { LegalAcceptanceRequestDto } from '../models/dto/legal-acceptance-request.dto';
import { LegalDocumentDto } from '../models/dto/legal-document.dto';
import { AcceptEmployeeInvitationRequestDto } from '../models/dto/accept-employee-invitation-request.dto';
import { EMPLOYEE_ONBOARDING_PURPOSE } from '../models/dto/invitation-preview.dto';
import { clearSingleHostTenant } from '../utils/single-host-tenant';
import { toCurrentUserViewModel } from '../utils/auth.mapper';
import { safeServerDetail } from '../../services/error-handler.service';

interface AuthState {
  authenticated: boolean;
  email: string | null;
  employeeId: string | null;
  permissions: string[];
  activeModules: string[];
  managesPeople: boolean;
  legalAcceptanceRequired: boolean;
  pendingLegalDocuments: LegalDocumentDto[];
  workspaceSlug: string | null;
  redirectRequired: boolean;
  continueUrl: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  authenticated: false,
  email: null,
  employeeId: null,
  permissions: [],
  activeModules: [],
  managesPeople: false,
  legalAcceptanceRequired: false,
  pendingLegalDocuments: [],
  workspaceSlug: null,
  redirectRequired: false,
  continueUrl: null,
  loading: false,
  error: null
};

const UNREACHABLE_MESSAGE = 'We could not reach the server. Check your connection and try again.';

function extractErrorMessage(err: unknown, fallback: string): string {
  return safeServerDetail(err) ?? fallback;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(initialState),
  withMethods((store, api = inject(AuthApiService)) => ({
    async login(payload: LoginRequestDto): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dto = await firstValueFrom(api.login(payload));
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          employeeId: view.employeeId,
          permissions: view.permissions,
          activeModules: view.activeModules,
          managesPeople: view.managesPeople,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          workspaceSlug: view.workspaceSlug,
          redirectRequired: view.redirectRequired,
          continueUrl: view.continueUrl,
          loading: false
        });
      } catch (err) {
        // status 0 = the request never reached the API (network/TLS/CORS), so the credentials
        // were never checked - same convention as exchange() below.
        const isUnreachable = err instanceof HttpErrorResponse && err.status === 0;
        patchState(store, {
          loading: false,
          error: isUnreachable
            ? UNREACHABLE_MESSAGE
            : extractErrorMessage(err, 'Invalid email or password.')
        });
        throw err;
      }
    },

    async acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dto = await firstValueFrom(api.acceptLegalDocuments(payload));
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          employeeId: view.employeeId,
          permissions: view.permissions,
          activeModules: view.activeModules,
          managesPeople: view.managesPeople,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          workspaceSlug: view.workspaceSlug,
          redirectRequired: view.redirectRequired,
          continueUrl: view.continueUrl,
          loading: false
        });
      } catch (err) {
        patchState(store, {
          loading: false,
          error: extractErrorMessage(err, 'Could not save your acceptance. Please try again.')
        });
        throw err;
      }
    },

    /**
     * Tenant-host-only, like exchangeSession(): the invite link opens on the employee's own
     * tenant subdomain and the backend command requires that host to resolve to the invitation's
     * tenant, so this deliberately does not retarget to the root/system host the way login() and
     * acceptLegalDocuments() do.
     */
    async acceptEmployeeInvitation(
      token: string,
      payload: AcceptEmployeeInvitationRequestDto,
      purpose: string = EMPLOYEE_ONBOARDING_PURPOSE
    ): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const request =
          purpose === EMPLOYEE_ONBOARDING_PURPOSE
            ? api.acceptEmployeeInvitation(token, payload)
            : api.acceptInvitationPassword(token, payload);
        const dto = await firstValueFrom(request);
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          employeeId: view.employeeId,
          permissions: view.permissions,
          activeModules: view.activeModules,
          managesPeople: view.managesPeople,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          workspaceSlug: view.workspaceSlug,
          redirectRequired: view.redirectRequired,
          continueUrl: view.continueUrl,
          loading: false
        });
      } catch (err) {
        patchState(store, {
          loading: false,
          error: extractErrorMessage(err, 'Could not complete your invitation. Please try again.')
        });
        throw err;
      }
    },

    async checkSession(): Promise<boolean> {
      patchState(store, { loading: true });
      try {
        const dto = await firstValueFrom(api.me());
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          employeeId: view.employeeId,
          permissions: view.permissions,
          activeModules: view.activeModules,
          managesPeople: view.managesPeople,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          workspaceSlug: view.workspaceSlug,
          redirectRequired: view.redirectRequired,
          continueUrl: view.continueUrl,
          loading: false
        });
        return view.authenticated;
      } catch {
        patchState(store, { ...initialState, loading: false });
        return false;
      }
    },

    /**
     * Tenant-host-only: consumes the one-time code from continue_url and, on success, is the call
     * that actually establishes crownus_session/crownus_csrf - login()/acceptLegalDocuments() never do
     * this themselves anymore once redirectRequired is true.
     */
    async exchangeSession(code: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dto = await firstValueFrom(api.sessionExchange(code));
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          employeeId: view.employeeId,
          permissions: view.permissions,
          activeModules: view.activeModules,
          managesPeople: view.managesPeople,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          workspaceSlug: view.workspaceSlug,
          redirectRequired: view.redirectRequired,
          continueUrl: view.continueUrl,
          loading: false
        });
      } catch (err) {
        // status 0 means the request never reached the server (network/TLS/CORS failure on the
        // tenant host), which is a distinct problem from a rejected/expired exchange code and
        // needs a different fix on the user's end - see error.interceptor.ts's retry condition
        // and ErrorHandlerService's ERROR_TAXONOMY[0] for the same status-0 convention.
        const isUnreachable = err instanceof HttpErrorResponse && err.status === 0;
        patchState(store, {
          loading: false,
          error: isUnreachable
            ? UNREACHABLE_MESSAGE
            : extractErrorMessage(err, 'This sign-in link is invalid or has expired. Please sign in again.')
        });
        throw err;
      }
    },

    async logout(): Promise<boolean> {
      try {
        await firstValueFrom(api.logout());
        return true;
      } catch {
        // Session is treated as gone client-side regardless of logout call outcome.
        return false;
      } finally {
        clearSingleHostTenant();
        patchState(store, initialState);
      }
    },

    clearSession(): void {
      patchState(store, initialState);
    }
  }))
);
