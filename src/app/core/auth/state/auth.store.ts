import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../data-access/auth-api.service';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { LegalAcceptanceRequestDto } from '../models/dto/legal-acceptance-request.dto';
import { LegalDocumentDto } from '../models/dto/legal-document.dto';
import { toCurrentUserViewModel } from '../utils/auth.mapper';

type AuthState = {
  authenticated: boolean;
  email: string | null;
  permissions: string[];
  activeModules: string[];
  legalAcceptanceRequired: boolean;
  pendingLegalDocuments: LegalDocumentDto[];
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  authenticated: false,
  email: null,
  permissions: [],
  activeModules: [],
  legalAcceptanceRequired: false,
  pendingLegalDocuments: [],
  loading: false,
  error: null
};

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { detail?: string } }).error;
    if (body?.detail) return body.detail;
  }
  return fallback;
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
          permissions: view.permissions,
          activeModules: view.activeModules,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          loading: false
        });
      } catch (err) {
        patchState(store, { loading: false, error: extractErrorMessage(err, 'Invalid email or password.') });
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
          permissions: view.permissions,
          activeModules: view.activeModules,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
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

    async checkSession(): Promise<boolean> {
      patchState(store, { loading: true });
      try {
        const dto = await firstValueFrom(api.me());
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          permissions: view.permissions,
          activeModules: view.activeModules,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          loading: false
        });
        return view.authenticated;
      } catch {
        patchState(store, { ...initialState, loading: false });
        return false;
      }
    },

    async logout(): Promise<void> {
      try {
        await firstValueFrom(api.logout());
      } catch {
        // Session is treated as gone client-side regardless of logout call outcome.
      } finally {
        patchState(store, initialState);
      }
    },

    clearSession(): void {
      patchState(store, initialState);
    }
  }))
);
