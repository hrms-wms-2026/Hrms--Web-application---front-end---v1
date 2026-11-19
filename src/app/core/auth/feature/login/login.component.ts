import { Component, OnInit, inject, signal } from '@angular/core';
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
  readLastTenantSlug
} from '../../utils/tenant-redirect';
import { parseSafeReturnPath } from '../../utils/safe-return-path';

interface RememberedAccount {
  displayName: string;
  workspaceSlug: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FieldIconComponent, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authApi = inject(AuthApiService);
  store = inject(AuthStore);

  readonly showPassword = signal(false);
  readonly checkingRememberedAccount = signal(false);
  readonly rememberedAccount = signal<RememberedAccount | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    if (isTenantHostname(window.location.hostname)) {
      // Keep ?returnUrl= so /device/activate can resume after the root-host login.
      const search = window.location.search || '';
      window.location.href = buildRootUrl(`/auth/login${search}`);
      return;
    }

    void this.loadRememberedAccount();
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
        workspaceSlug: dto.workspace.slug
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

  signInWithGoogle(): void {
    console.log('Initiating Google SSO login...');
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

    if (this.store.legalAcceptanceRequired()) {
      this.router.navigate(['/auth/legal-consent']);
    } else if (this.store.redirectRequired()) {
      const url = this.store.continueUrl();
      if (url) {
        // continueUrl already carries its own ?code=... query string, so append with '&'.
        // The tenant host's SessionExchangeComponent reads this same returnUrl param back out
        // once the session cookie is established there.
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        window.location.href = returnUrl ? `${url}&returnUrl=${encodeURIComponent(returnUrl)}` : url;
      }
    } else {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
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
