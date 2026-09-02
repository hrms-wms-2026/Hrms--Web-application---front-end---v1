import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Replaces the pre-consolidation standalone approval pages at the old URLs.
 * Forwards to the canonical Team > Approvals workspace inside Time Tracking,
 * preserving requestId, using replaceUrl so the obsolete URL doesn't remain
 * in browser history.
 */
@Component({
  selector: 'app-legacy-approval-redirect',
  standalone: true,
  template: ''
})
export class LegacyApprovalRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const approvalType = this.route.snapshot.data['approvalType'] as 'corrections' | 'work-area';
    const requestId = this.route.snapshot.queryParamMap.get('requestId');
    void this.router.navigate(['/attendance/time-tracking'], {
      queryParams: { view: 'team', type: approvalType, requestId },
      replaceUrl: true
    });
  }
}
