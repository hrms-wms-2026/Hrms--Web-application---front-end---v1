import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApprovalsListComponent } from './approvals-list.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PendingAccessGrantRequestResponse } from '../../models/access-grant-request.model';

describe('ApprovalsListComponent', () => {
  let fixture: ComponentFixture<ApprovalsListComponent>;
  let component: ApprovalsListComponent;
  let api: {
    listPendingApprovals: ReturnType<typeof vi.fn>;
    approveAccessGrantRequest: ReturnType<typeof vi.fn>;
    rejectAccessGrantRequest: ReturnType<typeof vi.fn>;
  };

  const pendingRequest: PendingAccessGrantRequestResponse = {
    id: 'req-1',
    actionType: 'position_change_access',
    employeeName: 'Jane Doe',
    targetPositionName: 'Head of Security',
    changeReason: 'Promotion',
    requestedByName: 'John Smith',
    requestedAt: '2026-08-17T10:00:00Z'
  };

  beforeEach(async () => {
    api = {
      listPendingApprovals: vi.fn().mockReturnValue(of([])),
      approveAccessGrantRequest: vi.fn().mockReturnValue(of({} as never)),
      rejectAccessGrantRequest: vi.fn().mockReturnValue(of({} as never))
    };

    await TestBed.configureTestingModule({
      imports: [ApprovalsListComponent],
      providers: [
        provideRouter([]),
        { provide: PeopleApiService, useValue: api },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalsListComponent);
    component = fixture.componentInstance;
  });

  it('renders pending requests with employee name, position, and requested-by', () => {
    api.listPendingApprovals.mockReturnValue(of([pendingRequest]));
    component.load();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Jane Doe');
    expect(text).toContain('Head of Security');
    expect(text).toContain('Promotion');
  });

  it('approve button calls approveAccessGrantRequest and reloads the list', () => {
    api.listPendingApprovals.mockReturnValue(of([pendingRequest]));
    component.load();
    fixture.detectChanges();

    component.approve('req-1');

    expect(api.approveAccessGrantRequest).toHaveBeenCalledWith('req-1');
  });

  it('reject prompts for a note and calls rejectAccessGrantRequest with it', () => {
    api.listPendingApprovals.mockReturnValue(of([pendingRequest]));
    component.load();
    fixture.detectChanges();

    component.rejectNote.set('Not enough justification');
    component.reject('req-1');

    expect(api.rejectAccessGrantRequest).toHaveBeenCalledWith('req-1', { decisionNote: 'Not enough justification' });
  });
});
