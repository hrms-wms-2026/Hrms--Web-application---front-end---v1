import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../data-access/auth-api.service';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { LegalAcceptanceRequestDto } from '../models/dto/legal-acceptance-request.dto';
import { LegalDocumentDto } from '../models/dto/legal-document.dto';
import { AcceptEmployeeInvitationRequestDto } from '../models/dto/accept-employee-invitation-request.dto';
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { WorkspaceSelectionRequiredDto } from '../models/dto/workspace-selection.dto';
import { toCurrentUserViewModel } from '../utils/auth.mapper';
import { safeServerDetail } from '../../services/error-handler.service';
import { UNREACHABLE_MESSAGE } from './auth-messages';
import type { LoginFlowContext } from './login-flows';

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
  /** Public Google Client ID; null = Google sign-in unavailable (disabled, blank or unreachable). */
  googleClientId: string | null;
  /** In-memory only: a 202 workspace challenge. Never persisted or put in a URL. */
  workspaceSelection: WorkspaceSelectionRequiredDto | null;
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
  googleClientId: null,
  workspaceSelection: null,
  loading: false,
  error: null,
};

function extractErrorMessage(err: unknown, fallback: string): string {
  return safeServerDetail(err) ?? fallback;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(initialState),
  withMethods((store, api = inject(AuthApiService)) => {
    /** Guards against GIS firing the credential callback twice: only one Google request at a time. */
    let googleLoginInFlight = false;

    const applyAuthResponse = (dto: AuthResponseDto): void => {
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
        workspaceSelection: null,
        loading: false,
      });
    };

    /**
     * Password login, Google login and workspace selection run only on the root-host login page,
     * so they live in login-flows.ts and are loaded on first use, outside the initial bundle.
     */
    const flowContext: LoginFlowContext = {
      api,
      workspaceSelection: () => store.workspaceSelection(),
      patch: (state) => patchState(store, state),
      applyAuthResponse,
    };

    return {
      async login(payload: LoginRequestDto): Promise<void> {
        const flows = await import('./login-flows');
        await flows.login(flowContext, payload);
      },

      /** Never throws: any failure just means the Google button stays hidden. */
      async loadGoogleSsoConfig(): Promise<void> {
        try {
          const flows = await import('./login-flows');
          patchState(store, { googleClientId: await flows.loadGoogleClientId(api) });
        } catch {
          patchState(store, { googleClientId: null });
        }
      },

      /**
       * Posts the Google ID token once and keeps no copy of it. Returns false (no request) when a
       * Google sign-in is already in progress, so a duplicate GIS callback can't double-submit.
       */
      async loginWithGoogle(idToken: string): Promise<boolean> {
        if (googleLoginInFlight) return false;
        googleLoginInFlight = true;
        try {
          const flows = await import('./login-flows');
          await flows.loginWithGoogle(flowContext, idToken);
          return true;
        } finally {
          googleLoginInFlight = false;
        }
      },

      async selectWorkspace(slug: string): Promise<void> {
        const flows = await import('./login-flows');
        await flows.selectWorkspace(flowContext, slug);
      },

      clearWorkspaceSelection(): void {
        patchState(store, { workspaceSelection: null, error: null });
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
            loading: false,
          });
        } catch (err) {
          patchState(store, {
            loading: false,
            error: extractErrorMessage(err, 'Could not save your acceptance. Please try again.'),
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
      ): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const dto = await firstValueFrom(api.acceptEmployeeInvitation(token, payload));
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
            loading: false,
          });
        } catch (err) {
          patchState(store, {
            loading: false,
            error: extractErrorMessage(
              err,
              'Could not complete your invitation. Please try again.',
            ),
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
            loading: false,
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
            loading: false,
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
              : extractErrorMessage(
                  err,
                  'This sign-in link is invalid or has expired. Please sign in again.',
                ),
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
          patchState(store, initialState);
        }
      },

      clearSession(): void {
        patchState(store, initialState);
      },
    };
  }),
);
