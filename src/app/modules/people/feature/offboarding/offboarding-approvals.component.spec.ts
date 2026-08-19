import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingApprovalsComponent } from './offboarding-approvals.component';

describe('OffboardingApprovalsComponent', () => {
  let fixture: ComponentFixture<OffboardingApprovalsComponent>;
  let approveSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    approveSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OffboardingApprovalsComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          listMyPendingBypassRequests: () => of([{
            id: 'br-1', employeeChecklistTaskId: 'task-1', offboardingRecordId: 'rec-1', requestedById: 'user-1',
            bypassReason: 'Payment processed in advance.', penaltyDescription: null, status: 'pending', requestedAt: '2026-08-17T00:00:00Z'
          }]),
          approveBypassRequest: approveSpy
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingApprovalsComponent);
    fixture.detectChanges();
  });

  it('loads pending approvals on init', async () => {
    await fixture.whenStable();
    expect(fixture.componentInstance.store.myPendingBypassRequests().length).toBe(1);
  });

  it('decide(approve) calls approveBypassRequest', async () => {
    await fixture.componentInstance.decide('br-1', 'approve');
    expect(approveSpy).toHaveBeenCalledWith('br-1');
  });
});
