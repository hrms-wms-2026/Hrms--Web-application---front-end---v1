import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { LegacyApprovalRedirectComponent } from './legacy-approval-redirect.component';

describe('LegacyApprovalRedirectComponent', () => {
  async function setup(approvalType: 'corrections' | 'work-area', requestId: string | null) {
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [LegacyApprovalRedirectComponent],
      providers: [
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { approvalType },
              queryParamMap: { get: (key: string) => (key === 'requestId' ? requestId : null) }
            }
          }
        }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(LegacyApprovalRedirectComponent);
    fixture.detectChanges();
    return { navigate };
  }

  it('redirects the legacy correction-approvals URL to the canonical Team/corrections URL, preserving requestId, with replacement navigation', async () => {
    const { navigate } = await setup('corrections', 'c1');
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', type: 'corrections', requestId: 'c1' }, replaceUrl: true }
    );
  });

  it('redirects the legacy work-area-approvals URL to the canonical Team/work-area URL, preserving requestId, with replacement navigation', async () => {
    const { navigate } = await setup('work-area', 'wa-1');
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', type: 'work-area', requestId: 'wa-1' }, replaceUrl: true }
    );
  });

  it('redirects without a requestId when none is present', async () => {
    const { navigate } = await setup('corrections', null);
    expect(navigate).toHaveBeenCalledWith(
      ['/attendance/time-tracking'],
      { queryParams: { view: 'team', type: 'corrections', requestId: null }, replaceUrl: true }
    );
  });
});
