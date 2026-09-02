import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { ApprovalRequestRowComponent } from './approval-request-row.component';
import { ApprovalItem } from '../../models/approval.model';
import { AllocationRequestDto } from '../../models/dto/allocation-request.dto';

function allocationItem(requestedAdditionalHours = 20): ApprovalItem {
  const raw: AllocationRequestDto = {
    id: 'allocation-1',
    objectiveId: 'objective-1',
    requestType: 'extend_allocation',
    status: 'pending',
    payload: { requestedAdditionalHours, reason: 'Need more capacity' },
    createdAt: '2026-08-27T00:00:00Z'
  };
  return {
    id: raw.id,
    kind: 'allocation_extend',
    title: `+${requestedAdditionalHours}h requested`,
    description: raw.payload.reason,
    requestedByName: null,
    createdAt: raw.createdAt,
    raw
  };
}

describe('ApprovalRequestRowComponent', () => {
  let fixture: ComponentFixture<ApprovalRequestRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ApprovalRequestRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(ApprovalRequestRowComponent);
    fixture.componentRef.setInput('item', allocationItem());
    fixture.detectChanges();
  });

  it('renders an editable allocation-hours input initialized from the requested amount', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="allocation-hours-input"]') as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe('20');
  });

  it('emits the edited allocation amount when approving', () => {
    const approved = vi.fn();
    fixture.componentInstance.approved.subscribe(approved);
    const input = fixture.nativeElement.querySelector('[data-testid="allocation-hours-input"]') as HTMLInputElement;
    input.value = '12';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('app-button[variant="primary"] button') as HTMLButtonElement).click();

    expect(approved).toHaveBeenCalledWith(12);
  });

  it('emits requestOwnAllocation from the existing inline action', () => {
    const requestOwnAllocation = vi.fn();
    fixture.componentRef.setInput('inlineError', 'Not enough allocation');
    fixture.componentInstance.requestOwnAllocation.subscribe(requestOwnAllocation);
    fixture.detectChanges();

    const action = fixture.debugElement.query(By.css('.approval-row__link')).nativeElement as HTMLButtonElement;
    action.click();

    expect(requestOwnAllocation).toHaveBeenCalledTimes(1);
  });
});
