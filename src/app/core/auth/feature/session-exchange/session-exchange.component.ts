import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';

/**
 * Landing page for continue_url (https://{slug}.{rootDomain}/auth/continue?code=...). Consumes the
 * one-time exchange code against this same tenant host's POST /auth/session-exchange - the call
 * that actually sets onevo_session/onevo_csrf. The base host never sets those cookies itself.
 */
@Component({
  selector: 'app-session-exchange',
  standalone: true,
  imports: [LoaderComponent, CardComponent],
  templateUrl: './session-exchange.component.html'
})
export class SessionExchangeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  store = inject(AuthStore);

  failed = signal(false);

  async ngOnInit(): Promise<void> {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.failed.set(true);
      return;
    }

    try {
      await this.store.exchangeSession(code);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl) {
        await this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch {
      this.failed.set(true);
    }
  }

  backToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
