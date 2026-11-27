import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldIconComponent } from '../../../../shared/ui/field-icon/field-icon.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthStore } from '../../state/auth.store';
import { AuthApiService } from '../../data-access/auth-api.service';
import {
  buildRootUrl,
  buildTenantUrl,
  isTenantHostname,
  readLastTenantSlug,
} from '../../utils/tenant-redirect';
import { parseSafeReturnPath, toSafeInternalPath } from '../../utils/safe-return-path';
import { GoogleIdentityService } from '../../data-access/google-identity.service';
import { WorkspaceSelectorComponent } from './workspace-selector.component';
import { fieldError } from '../../../../shared/utils/validators';

interface RememberedAccount {
  displayName: string;
  workspaceSlug: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FieldIconComponent, RouterLink, WorkspaceSelectorComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authApi = inject(AuthApiService);
  // GIS is a browser SDK that must draw into this component's DOM, so it's injected here;
  // all HTTP still goes through AuthStore.
  private googleIdentity = inject(GoogleIdentityService);
  store = inject(AuthStore);

  readonly googleButtonHost = viewChild.required<ElementRef<HTMLElement>>('googleButtonHost');
  /** True only after Google's own button has actually been drawn. */
  readonly googleReady = signal(false);

  readonly showPassword = signal(false);
  readonly checkingRememberedAccount = signal(false);
  readonly rememberedAccount = signal<RememberedAccount | null>(null);

  protected readonly fieldError = fieldError;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (isTenantHostname(window.location.hostname)) {
      // Keep ?returnUrl= so /device/activate can resume after the root-host login.
      const search = window.location.search || '';
      window.location.href = buildRootUrl(`/auth/login${search}`);
      return;
    }

    void this.loadRememberedAccount();
    void this.setupGoogleSignIn();
  }

  /**
   * Root host only (ngOnInit returns early on a tenant host). Disabled/blank config means no
   * button and no GIS script load. Any failure leaves password login fully usable.
   */
  private async setupGoogleSignIn(): Promise<void> {
    try {
      await this.store.loadGoogleSsoConfig();
      const clientId = this.store.googleClientId();
      if (!clientId) return;

      await this.googleIdentity.renderSignInButton(
        this.googleButtonHost().nativeElement,
        clientId,
        (idToken) => void this.completeGoogleSignIn(idToken),
      );
      this.googleReady.set(true);
    } catch {
      // Script blocked, offline, or GIS failed: hide Google, keep password login.
      this.googleReady.set(false);
    }
  }

  /** The ID token is passed straight to the store and not kept anywhere in this component. */
  async completeGoogleSignIn(idToken: string): Promise<void> {
    let sent: boolean;
    try {
      sent = await this.store.loginWithGoogle(idToken);
    } catch {
      return; // store.error() is shown in the template
    }
    if (!sent) return; // duplicate GIS callback while a sign-in is already running
    await this.navigateAfterLogin();
  }

  async chooseWorkspace(slug: string): Promise<void> {
    try {
      await this.store.selectWorkspace(slug);
    } catch {
      return; // challenge cleared; store.error() asks the user to sign in again
    }
    await this.navigateAfterLogin();
  }

  cancelWorkspaceSelection(): void {
    this.store.clearWorkspaceSelection();
  }

  private async loadRememberedAccount(): Promise<void> {
    const hintedSlug = readLastTenantSlug(document.cookie);
    if (!hintedSlug) return;

    this.checkingRememberedAccount.set(true);
    try {
      const dto = await firstValueFrom(this.authApi.meForTenant(hintedSlug).pipe(timeout(3000)));
      const displayName = dto.user?.display_name?.trim();
      if (!dto.authenticated || dto.workspace?.slug !== hintedSlug || !displayName) return;

      this.rememberedAccount.set({
        displayName,
        workspaceSlug: dto.workspace.slug,
      });
    } catch {
      // A missing, expired, or unreachable tenant session simply falls back to credential login.
    } finally {
      this.checkingRememberedAccount.set(false);
    }
  }

  continueWithRememberedAccount(): void {
    const account = this.rememberedAccount();
    if (!account) return;

    const returnPath = parseSafeReturnPath(this.route.snapshot.queryParamMap.get('returnUrl'));
    window.location.href = buildTenantUrl(account.workspaceSlug, returnPath ?? '/dashboard');
  }

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  async submit(): Promise<void> {
    if (isTenantHostname(window.location.hostname)) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      await this.store.login(this.form.getRawValue());
    } catch {
      return;
    }

    await this.navigateAfterLogin();
  }

  /** One routing path for password, Google and workspace-selection logins. */
  private async navigateAfterLogin(): Promise<void> {
    // 202: the template now shows the workspace picker; wait for the user's choice.
    if (this.store.workspaceSelection()) return;

    // Only a same-origin app path survives; external/unsafe values are dropped.
    const returnUrl = toSafeInternalPath(this.route.snapshot.queryParamMap.get('returnUrl'));

    if (this.store.legalAcceptanceRequired()) {
      this.router.navigate(['/auth/legal-consent']);
    } else if (this.store.redirectRequired()) {
      const url = this.store.continueUrl();
      if (url) {
        // continueUrl already carries its own ?code=... query string, so append with '&'.
        // The tenant host's SessionExchangeComponent reads this same returnUrl param back out
        // once the session cookie is established there.
        window.location.href = returnUrl
          ? `${url}&returnUrl=${encodeURIComponent(returnUrl)}`
          : url;
      }
    } else {
      if (returnUrl) {
        // navigate([returnUrl]) would treat the whole string (path + query string) as one
        // literal path segment and silently drop the query params — navigateByUrl parses it
        // as a real URL instead, which a route like /device/activate?request_id=...&user_code=...
        // depends on.
        await this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/people/employees']);
      }
    }
  }
}
