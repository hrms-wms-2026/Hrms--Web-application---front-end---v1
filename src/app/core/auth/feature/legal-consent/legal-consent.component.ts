import { Component, OnInit, inject } from '@angular/core';
import { AuthStore } from '../../state/auth.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { buildRootUrl, isTenantHostname } from '../../utils/tenant-redirect';

@Component({
  selector: 'app-legal-consent',
  standalone: true,
  imports: [ButtonComponent, CardComponent],
  templateUrl: './legal-consent.component.html'
})
export class LegalConsentComponent implements OnInit {
  store = inject(AuthStore);

  ngOnInit(): void {
    // acceptLegalDocuments() posts to the root/system host that issued onevo_legal_pending; a
    // tenant host that somehow reached this route with a pending base-login acceptance has to be
    // bounced back to the root host, which is the only place that cookie is valid.
    if (this.store.legalAcceptanceRequired() && isTenantHostname(window.location.hostname)) {
      window.location.href = buildRootUrl('/auth/legal-consent');
    }
  }

  async accept(): Promise<void> {
    const acceptances = this.store.pendingLegalDocuments().map((doc) => ({
      document_type: doc.document_type,
      version: doc.version,
      decision: 'accepted' as const
    }));

    try {
      await this.store.acceptLegalDocuments({ acceptances });
    } catch {
      return;
    }

    // Every gate cleared, but this is still the base host: hand off to the tenant host's
    // /auth/continue, which consumes the one-time code and creates the real session there.
    const url = this.store.continueUrl();
    if (this.store.redirectRequired() && url) {
      window.location.href = url;
    }
  }
}
