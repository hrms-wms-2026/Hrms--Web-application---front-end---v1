import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkEmployeeActionResponse } from '../../models/employee.model';
import { BulkActionResultModalComponent } from './bulk-action-result-modal.component';
import { BulkEmploymentTypeModalComponent } from './bulk-employment-type-modal.component';
import { BulkStartOffboardingModalComponent } from './bulk-start-offboarding-modal.component';

const response: BulkEmployeeActionResponse = {
  items: [
    { employeeId: 'a', outcome: 'succeeded', reason: null },
    { employeeId: 'b', outcome: 'pendingApproval', reason: null },
    { employeeId: 'c', outcome: 'failed', reason: 'You cannot change your own position.' }
  ],
  succeeded: 1, pendingApproval: 1, failed: 1
};

describe('bulk employee action dialogs', () => {
  let people: { bulkChangeEmploymentType: ReturnType<typeof vi.fn>; bulkStartOffboarding: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    people = { bulkChangeEmploymentType: vi.fn(() => of(response)), bulkStartOffboarding: vi.fn(() => of(response)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: PeopleApiService, useValue: people },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    });
  });

  it('employment type: submit is disabled until a type is chosen, then posts ids + code and emits completed', () => {
    const fixture = TestBed.createComponent(BulkEmploymentTypeModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('employeeIds', ['a', 'b']);
    fixture.detectChanges();
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);

    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.code.set('contract');
    fixture.componentInstance.submit();

    expect(people.bulkChangeEmploymentType).toHaveBeenCalledWith({ employeeIds: ['a', 'b'], employmentTypeCode: 'contract' });
    expect(completed).toHaveBeenCalledWith(response);
  });

  it('start offboarding: requires a last working date and posts the shared exit details', () => {
    const fixture = TestBed.createComponent(BulkStartOffboardingModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('employeeIds', ['a']);
    fixture.detectChanges();

    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.lastWorkingDate.set('2026-10-31');
    fixture.componentInstance.reason.set('retirement');
    fixture.componentInstance.submit();

    expect(people.bulkStartOffboarding).toHaveBeenCalledWith({
      employeeIds: ['a'], reason: 'retirement', lastWorkingDate: '2026-10-31',
      knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null
    });
  });

  it('result modal summarises counts and lists failures with names and reasons', () => {
    const fixture = TestBed.createComponent(BulkActionResultModalComponent);
    fixture.componentRef.setInput('result', response);
    fixture.componentRef.setInput('title', 'Promote results');
    fixture.componentRef.setInput('names', new Map([['c', 'Cara Diaz']]));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="bulk-result-summary"]')!.textContent).toContain('1 changed · 1 sent for approval · 1 skipped');
    const failure = el.querySelector('[data-testid="bulk-result-failure-c"]')!.textContent!;
    expect(failure).toContain('Cara Diaz');
    expect(failure).toContain('You cannot change your own position.');
  });
});
