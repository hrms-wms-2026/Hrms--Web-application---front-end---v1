import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LeaveBalanceStore } from '../../../leave/state/leave-balance.store';
import { LeaveRequestStore } from '../../../leave/state/leave-request.store';
import { LeaveTypeStore } from '../../../leave/state/leave-type.store';
import { CreateSlot } from './planner-create-draft';
import { TimeOffTabComponent } from './time-off-tab.component';

describe('TimeOffTabComponent', () => {
  const slot: CreateSlot = { date: '2026-11-10', startMinutes: 540, endMinutes: 660, startIso: '2026-11-10T09:00:00.000Z', endIso: '2026-11-10T11:00:00.000Z' };
  const types = [
    { id: 'annual', name: 'Annual', isActive: true, requiresDocument: false, documentRequiredAfterHours: null },
    { id: 'sick', name: 'Sick', isActive: true, requiresDocument: true, documentRequiredAfterHours: 1 },
    { id: 'old', name: 'Old', isActive: false, requiresDocument: false, documentRequiredAfterHours: null },
  ];

  function setup() {
    const requests = {
      preview: vi.fn(async () => undefined), submit: vi.fn(async () => ({ id: 'lr1' })), clearPreview: vi.fn(),
      previewing: signal(false), previewError: signal<string | null>(null),
      previewResult: signal<{ totalHours: number; exceedsBalanceByHours?: number; balanceImpact?: { remainingAfterSubmitHours: number };
        approvers?: { approverName: string; sequenceOrder: number }[] } | null>(null),
      submitting: signal(false), submitError: signal<string | null>(null),
    };
    TestBed.configureTestingModule({
      imports: [TimeOffTabComponent],
      providers: [
        { provide: LeaveTypeStore, useValue: { items: signal(types), load: vi.fn(async () => undefined) } },
        { provide: LeaveBalanceStore, useValue: { my: signal([{ leaveTypeId: 'annual', remainingHours: 64 }]), loadMy: vi.fn(async () => undefined) } },
        { provide: LeaveRequestStore, useValue: requests },
      ],
    });
    const fixture = TestBed.createComponent(TimeOffTabComponent);
    fixture.componentRef.setInput('slot', slot);
    fixture.detectChanges();
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const chooseType = (id: string) => {
      const el = q('time-off-type') as HTMLSelectElement;
      el.value = id;
      el.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, q, chooseType, requests };
  }

  // Follow-up 6: the preview names the real approvers and the balance left, not a fixed "your manager approves".
  it('the preview shows the hours, the balance left after it and who approves', () => {
    const { fixture, q, requests } = setup();
    requests.previewResult.set({ totalHours: 8, balanceImpact: { remainingAfterSubmitHours: 56 },
      approvers: [{ approverName: 'Priya K.', sequenceOrder: 2 }, { approverName: 'Suresh M.', sequenceOrder: 1 }] });
    fixture.detectChanges();
    expect(q('time-off-preview')!.textContent!.trim()).toBe('8h · 56h left after this · Approved by Suresh M., then Priya K.');
  });

  it('the preview warns when it goes past the balance, and leaves the approver out when there is none', () => {
    const { fixture, q, requests } = setup();
    requests.previewResult.set({ totalHours: 8, exceedsBalanceByHours: 4, balanceImpact: { remainingAfterSubmitHours: 0 }, approvers: [] });
    fixture.detectChanges();
    expect(q('time-off-preview')!.textContent!.trim()).toBe('8h · 4h over your balance');
    expect(q('time-off-preview')!.textContent).not.toContain('manager');
  });

  it('lists active leave types with remaining hours', () => {
    const { q } = setup();
    const labels = Array.from((q('time-off-type') as HTMLSelectElement).options).map((o) => o.textContent!.trim());
    expect(labels).toEqual(['Choose a leave type', 'Annual – 64 hours remaining', 'Sick']);
  });

  it('previews the policy when type and times are set', () => {
    const { chooseType, requests } = setup();
    chooseType('annual');
    expect(requests.preview).toHaveBeenCalledWith({ leaveTypeId: 'annual', startAt: slot.startIso, endAt: slot.endIso, reason: null, fileRecordIds: [] });
  });

  it('Submit sends one request with the slot\'s startAt/endAt', async () => {
    const { fixture, q, chooseType, requests } = setup();
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    chooseType('annual');

    q('time-off-submit')!.click();
    q('time-off-submit')!.click();
    await fixture.whenStable();

    expect(requests.submit).toHaveBeenCalledTimes(1);
    expect(requests.submit).toHaveBeenCalledWith({ leaveTypeId: 'annual', startAt: slot.startIso, endAt: slot.endIso, reason: null, fileRecordIds: [] });
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('a type needing a document for this length disables Submit and points to More options', () => {
    const { q, chooseType } = setup();
    chooseType('sick');
    expect((q('time-off-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(q('time-off-document-note')!.textContent).toContain('More options');
  });

  it('More options emits the type, the slot and the reason', () => {
    const { fixture, q, chooseType } = setup();
    const more = vi.fn();
    fixture.componentInstance.moreOptions.subscribe(more);
    chooseType('sick');
    q('time-off-more')!.click();
    expect(more).toHaveBeenCalledWith({ leaveTypeId: 'sick', startIso: slot.startIso, endIso: slot.endIso, reason: null });
  });
});
