import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

/**
 * Placeholder landing page for the authenticated area. Proves authGuard + AuthStore work
 * end-to-end (login -> legal consent -> here -> sign out). The real dashboard module
 * (ARCHITECTURE.md's modules/dashboard/) is out of scope for this plan and replaces this.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 class="text-2xl font-semibold text-slate-900">Welcome, {{ store.email() }}</h1>
      <p class="mt-2 text-slate-500">You're signed in to ONEVO HRMS.</p>
      <div class="mt-6 inline-block">
        <app-button variant="secondary" (pressed)="signOut()">Sign out</app-button>
      </div>
    </div>
  `
})
export class DashboardHomeComponent {
  store = inject(AuthStore);
  private router = inject(Router);

  async signOut(): Promise<void> {
    await this.store.logout();
    this.router.navigate(['/auth/login']);
  }
}
