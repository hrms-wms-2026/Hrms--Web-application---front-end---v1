import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkAreaChangeRequestResponse } from '../../models/work-area-change-request.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { WorkAreaApprovalsComponent } from './work-area-approvals.component';

const pending: WorkAreaChangeRequestResponse = {
  id: 'wa-1',
  employeeId: 'employee-1',
  legalEntityId: 'entity-1',
  requesterDisplayName: 'Jordan Lee',
  timezone: 'Asia/Colombo',
  date: '2026-08-22',
  currentExpectedWorkArea: 'onsite',
  requestedWorkArea: 'remote',
  reason: 'Client meeting',
  status: 'pending',
  requestedAt: '2026-08-21T06:00:00.000Z',
  reviewedById: null,
  reviewerDisplayName: null,
  reviewedAt: null,
  reviewComment: null,
  receiver: { employeeId: 'approver-1', userId: 'user-1', displayName: 'Avery Smith', positionName: 'Manager' }
};

interface ApprovalStoreMock {
  workAreaApprovalInbox: ReturnType<typeof signal<readonly WorkAreaChangeRequestResponse[]>>;
  workAreaApprovalInboxLoading: ReturnType<typeof signal<boolean>>;
  workAreaApprovalInboxError: ReturnType<typeof signal<string | null>>;
  workAreaApprovalInboxPage: ReturnType<typeof signal<number>>;
  workAreaApprovalInboxPageSize: ReturnType<typeof signal<number>>;
  workAreaApprovalInboxTotalCount: ReturnType<typeof signal<number>>;
  workAreaApprovalInboxLoaded: ReturnType<typeof signal<boolean>>;
  workAreaActionLoading: ReturnType<typeof signal<boolean>>;
  loadWorkAreaApprovalInbox: ReturnType<typeof vi.fn>;
  selectWorkAreaApprovalRequest: ReturnType<typeof vi.fn>;
  approveWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
  rejectWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
}

describe('WorkAreaApprovalsComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    items?: readonly WorkAreaChangeRequestResponse[];
    requestId?: string | null;
    loading?: boolean;
    error?: string | null;
    approveResult?: WorkAreaChangeRequestResponse | null;
    rejectResult?: WorkAreaChangeRequestResponse | null;
  } = {}): Promise<{ fixture: ComponentFixture<WorkAreaApprovalsComponent>; component: WorkAreaApprovalsComponent; store: ApprovalStoreMock }> {
    const items = options.items ?? [pending];
    const store: ApprovalStoreMock = {
      workAreaApprovalInbox: signal(items),
      workAreaApprovalInboxLoading: signal(options.loading ?? false),
      workAreaApprovalInboxError: signal(options.error ?? null),
      workAreaApprovalInboxPage: signal(1),
      workAreaApprovalInboxPageSize: signal(20),
      workAreaApprovalInboxTotalCount: signal(items.length),
      workAreaApprovalInboxLoaded: signal(false),
      workAreaActionLoading: signal(false),
      loadWorkAreaApprovalInbox: vi.fn(() => Promise.resolve()),
      selectWorkAreaApprovalRequest: vi.fn(),
      approveWorkAreaChangeRequest: vi.fn(() => Promise.resolve(options.approveResult !== undefined ? options.approveResult : { ...pending, status: 'approved' })),
      rejectWorkAreaChangeRequest: vi.fn(() => Promise.resolve(options.rejectResult !== undefined ? options.rejectResult : { ...pending, status: 'rejected' }))
    };

    await TestBed.configureTestingModule({
      imports: [WorkAreaApprovalsComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => options.requestId ?? null } } } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkAreaApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, store };
  }

  it('renders pending requests', async () => {
    const { fixture, store } = await setup();
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('On-site');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Remote');
  });

  it('renders a friendly empty inbox state', async () => {
    const { fixture } = await setup({ items: [] });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No pending work-area approvals.');
  });

  it('renders the loading state', async () => {
    const { fixture } = await setup({ items: [], loading: true });
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders a sanitized retry state for load failure', async () => {
    const { fixture } = await setup({ items: [], error: 'Could not load work-area approvals. Try again.' });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Could not load work-area approvals. Try again.');
    expect(element.textContent).not.toContain('SQL');
    expect(element.textContent).toContain('Try again');
  });

  it('opens review for the selected request', async () => {
    const { fixture, component, store } = await setup();
    component.openReview(pending);
    fixture.detectChanges();
    expect(component.reviewRequest()).toEqual(pending);
    expect(store.selectWorkAreaApprovalRequest).toHaveBeenCalledWith(pending);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Avery Smith');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Client meeting');
  });

  it('opens a matching pending request from a deep link without extra lookups', async () => {
    const { component, store } = await setup({ requestId: 'wa-1' });

    expect(component.reviewRequest()).toEqual(pending);
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledTimes(1);
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledWith({ status: 'pending', pageNumber: 1 });
  });

  it('moves approve to confirmation without opening two modals', async () => {
    const { fixture, component } = await setup();
    component.openReview(pending);
    component.review('approve');
    fixture.detectChanges();
    expect(component.confirmationDecision()).toBe('approve');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-modal').length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('This approval changes the requested work area');
  });

  it('calls approve exactly once after confirmation', async () => {
    const { fixture, component, store } = await setup();
    component.openReview(pending);
    component.review('approve');
    await component.confirmReview();
    fixture.detectChanges();
    expect(store.approveWorkAreaChangeRequest).toHaveBeenCalledTimes(1);
    expect(store.approveWorkAreaChangeRequest).toHaveBeenCalledWith('wa-1', null);
  });

  it('requires a nonblank rejection reason', async () => {
    const { component, store } = await setup();
    component.openReview(pending);
    component.review('reject');
    expect(store.rejectWorkAreaChangeRequest).not.toHaveBeenCalled();
    expect(component.rejectionValidationError()).toContain('reason');
  });

  it('rejects whitespace-only reasons', async () => {
    const { component, store } = await setup();
    component.openReview(pending);
    component.reviewComment.set('   \n  ');
    component.review('reject');
    expect(store.rejectWorkAreaChangeRequest).not.toHaveBeenCalled();
    expect(component.rejectionValidationError()).toContain('reason');
  });

  it('calls reject exactly once for a valid trimmed reason', async () => {
    const { component, store } = await setup();
    component.openReview(pending);
    component.reviewComment.set('  Incorrect work area  ');
    component.review('reject');
    await component.confirmReview();
    expect(store.rejectWorkAreaChangeRequest).toHaveBeenCalledTimes(1);
    expect(store.rejectWorkAreaChangeRequest).toHaveBeenCalledWith('wa-1', 'Incorrect work area');
  });

  it('disables review buttons while an action is running', async () => {
    const { fixture, component, store } = await setup();
    component.openReview(pending);
    component.review('approve');
    store.workAreaActionLoading.set(true);
    fixture.detectChanges();
    const actionButtons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.review-actions button'));
    expect(actionButtons.length).toBeGreaterThan(0);
    actionButtons.forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(true));
  });

  it('closes the workflow and refreshes the inbox after success', async () => {
    const { fixture, component, store } = await setup();
    component.openReview(pending);
    component.review('approve');
    await component.confirmReview();
    fixture.detectChanges();
    expect(component.reviewRequest()).toBeNull();
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledTimes(2);
  });

  it('keeps the review workflow open and shows a friendly error after a conflict', async () => {
    const { fixture, component } = await setup({ approveResult: null });
    component.openReview(pending);
    component.review('approve');
    await component.confirmReview();
    fixture.detectChanges();
    expect(component.reviewRequest()).toEqual(pending);
    expect(component.reviewActionError()).toContain('could not be updated');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('wa-1');
  });

  it('uses Back to return from confirmation and restores opener focus on close', async () => {
    const { component } = await setup();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    component.openReview(pending);
    component.review('approve');
    component.cancelConfirmation();
    expect(component.confirmationDecision()).toBeNull();
    expect(component.reviewRequest()).toEqual(pending);
    component.closeReview();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('shows a neutral message when a deep-linked request is absent from the loaded page', async () => {
    const { component, store } = await setup({ requestId: 'not-on-current-page' });

    expect(component.pageMessage()).toBe('Open the pending requests list to review this request.');
    expect(component.pageMessage()).not.toContain('no longer waiting');
    expect(component.reviewRequest()).toBeNull();
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledTimes(1);
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledWith({ status: 'pending', pageNumber: 1 });

    component.openReview(pending);
    expect(component.pageMessage()).toBe('Open the pending requests list to review this request.');
    expect(component.reviewActionError()).toBe('');
  });

  it('does not expose raw backend error details in the approval workflow', async () => {
    const { fixture, component } = await setup({ approveResult: null });
    component.openReview(pending);
    component.review('approve');
    await component.confirmReview();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('HttpErrorResponse');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('status code 409');
  });

  it('uses safe fallbacks for invalid dates and timezones', async () => {
    const { component } = await setup();
    expect(component.formatDate('not-a-date')).toBe('Date unavailable');
    expect(component.formatDate('2026-02-31')).toBe('Date unavailable');
    expect(component.formatDateTime('not-a-timestamp', 'Asia/Colombo')).toBe('—');
    expect(component.formatDateTime(null, 'Asia/Colombo')).toBe('—');
    expect(component.formatDateTime(pending.requestedAt, null)).toBe('—');
    expect(component.formatDateTime(pending.requestedAt, 'Invalid/Timezone')).toBe('—');
  });

  it('hides the breadcrumb and page heading when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('#work-area-approvals-heading')).toBeNull();
  });

  it('still shows the breadcrumb and heading when not embedded', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeTruthy();
  });

  it('does not re-fetch the inbox on init when the store already has a loaded inbox', async () => {
    const store: ApprovalStoreMock = {
      workAreaApprovalInbox: signal([pending]),
      workAreaApprovalInboxLoading: signal(false),
      workAreaApprovalInboxError: signal(null),
      workAreaApprovalInboxPage: signal(1),
      workAreaApprovalInboxPageSize: signal(20),
      workAreaApprovalInboxTotalCount: signal(1),
      workAreaApprovalInboxLoaded: signal(true),
      workAreaActionLoading: signal(false),
      loadWorkAreaApprovalInbox: vi.fn(() => Promise.resolve()),
      selectWorkAreaApprovalRequest: vi.fn(),
      approveWorkAreaChangeRequest: vi.fn(),
      rejectWorkAreaChangeRequest: vi.fn()
    };
    await TestBed.configureTestingModule({
      imports: [WorkAreaApprovalsComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(WorkAreaApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.loadWorkAreaApprovalInbox).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
  });

  it('still fetches on init when the store has no loaded inbox yet', async () => {
    const { store } = await setup();
    expect(store.loadWorkAreaApprovalInbox).toHaveBeenCalledTimes(1);
  });
});
