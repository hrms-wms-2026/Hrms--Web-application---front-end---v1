import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';

@Component({
  selector: 'app-legal-consent',
  standalone: true,
  imports: [ButtonComponent, CardComponent],
  templateUrl: './legal-consent.component.html'
})
export class LegalConsentComponent {
  private router = inject(Router);
  store = inject(AuthStore);

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

    if (this.store.authenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }
}
