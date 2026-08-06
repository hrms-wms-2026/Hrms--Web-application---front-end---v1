import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { buildRootUrl, isTenantHostname } from '../../utils/tenant-redirect';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  store = inject(AuthStore);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    // POST /auth/login only works against the root/system host (see getSystemApiUrl); a tenant
    // subdomain must never submit credentials itself, so bounce it to the root host's /auth/login
    // before the form can be used.
    if (isTenantHostname(window.location.hostname)) {
      window.location.href = buildRootUrl('/auth/login');
    }
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
      // Every gate cleared, but this is still the base host: hand off to the tenant host's
      // /auth/continue, which consumes the one-time code and creates the real session there.
      const url = this.store.continueUrl();
      if (url) {
        window.location.href = url;
      }
    }
  }
}
