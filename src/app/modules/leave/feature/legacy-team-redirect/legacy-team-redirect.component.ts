import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Replaces the pre-consolidation standalone /time-off/team-approvals and
 * /time-off/all pages. Forwards to the canonical Team hub, using replaceUrl
 * so the obsolete URL doesn't remain in browser history.
 */
@Component({
  selector: 'app-legacy-team-redirect',
  standalone: true,
  template: ''
})
export class LegacyTeamRedirectComponent implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigate(['/time-off/team'], { replaceUrl: true });
  }
}
