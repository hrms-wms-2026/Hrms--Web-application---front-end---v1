import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { buildRootUrl, isTenantHostname } from '../../utils/tenant-redirect';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  store = inject(AuthStore);

  readonly showPassword = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    if (isTenantHostname(window.location.hostname)) {
      window.location.href = buildRootUrl('/auth/login');
    }
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
