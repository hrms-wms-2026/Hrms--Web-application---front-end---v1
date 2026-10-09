import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationChangeRequestResponse } from '../../models/location-change-request.model';
import { LocationChangeRequestsStore } from '../../state/location-change-requests.store';
import { LocationChangeApprovalsComponent } from './location-change-approvals.component';

const pending: LocationChangeRequestResponse = {
  id: 'lc-1',
  employeeId: 'employee-1',
  requesterDisplayName: 'Jordan Lee',
  requestedLatitude: 6.9271,
  requestedLongitude: 79.8612,
  requestedAccuracyMeters: 12,
  reason: 'Working from client site',
  status: 'pending',
  requestedAt: '2026-09-16T06:00:00.000Z',
  reviewedById: null,
  reviewedAt: null,
  reviewComment: null,
  appliedAt: null
};

interface ApprovalStoreMock {
  approvalInbox: ReturnType<typeof signal<readonly LocationChangeRequestResponse[]>>;
  approvalInboxLoading: ReturnType<typeof signal<boolean>>;
  approvalInboxLoaded: ReturnType<typeof signal<boolean>>;
  approvalInboxError: ReturnType<typeof signal<string | null>>;
  approvalInboxPage: ReturnType<typeof signal<number>>;
  approvalInboxPageSize: ReturnType<typeof signal<number>>;
  approvalInboxTotalCount: ReturnType<typeof signal<number>>;
  actionLoading: ReturnType<typeof signal<boolean>>;
  loadApprovalInbox: ReturnType<typeof vi.fn>;
  approve: ReturnType<typeof vi.fn>;
  reject: ReturnType<typeof vi.fn>;
}

describe('LocationChangeApprovalsComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    items?: readonly LocationChangeRequestResponse[];
    loaded?: boolean;
    loading?: boolean;
    error?: string | null;
    approveResult?: LocationChangeRequestResponse | null;
    rejectResult?: LocationChangeRequestResponse | null;
    requestId?: string | null;
  } = {}): Promise<{ fixture: ComponentFixture<LocationChangeApprovalsComponent>; component: LocationChangeApprovalsComponent; store: ApprovalStoreMock }> {
    const items = options.items ?? [pending];
    const store: ApprovalStoreMock = {
      approvalInbox: signal(items),
      approvalInboxLoading: signal(options.loading ?? false),
      approvalInboxLoaded: signal(options.loaded ?? false),
      approvalInboxError: signal(options.error ?? null),
      approvalInboxPage: signal(1),
      approvalInboxPageSize: signal(20),
      approvalInboxTotalCount: signal(items.length),
      actionLoading: signal(false),
      loadApprovalInbox: vi.fn(() => Promise.resolve()),
      approve: vi.fn(() => Promise.resolve(options.approveResult !== undefined ? options.approveResult : { ...pending, status: 'approved' })),
      reject: vi.fn(() => Promise.resolve(options.rejectResult !== undefined ? options.rejectResult : { ...pending, status: 'rejected' }))
    };

    await TestBed.configureTestingModule({
      imports: [LocationChangeApprovalsComponent],
      providers: [
        provideRouter([]),
        { provide: LocationChangeRequestsStore, useValue: store },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => options.requestId ?? null } } } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(LocationChangeApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, store };
  }

  it('renders the pending list from the store', async () => {
    const { fixture, store } = await setup();
    expect(store.loadApprovalInbox).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
  });

  it('renders a friendly empty inbox state', async () => {
    const { fixture } = await setup({ items: [] });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No pending location change requests.');
  });

  it('does not re-fetch the inbox on init when the store already has a loaded inbox', async () => {
    const { store } = await setup({ loaded: true });
    expect(store.loadApprovalInbox).not.toHaveBeenCalled();
  });

  it('calls approve with the request id on Approve click', async () => {
    const { component, store } = await setup();
    component.openReview(pending);
    component.review('approve');
    await component.confirmReview();
    expect(store.approve).toHaveBeenCalledTimes(1);
    expect(store.approve).toHaveBeenCalledWith('lc-1', null);
  });

  it('opens a matching pending request from a deep link without extra lookups', async () => {
    const { component, store } = await setup({ requestId: 'lc-1' });

    expect(component.reviewRequest()).toEqual(pending);
    expect(store.loadApprovalInbox).toHaveBeenCalledTimes(1);
    expect(store.loadApprovalInbox).toHaveBeenCalledWith(1);
  });

  it('shows a neutral message when a deep-linked request is absent from the loaded page', async () => {
    const { component, fixture } = await setup({ requestId: 'not-on-current-page' });

    expect(component.reviewRequest()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Open the pending requests list to review this request.');
  });

  it('does not attempt a deep link when no requestId query param is present', async () => {
    const { component } = await setup();
    expect(component.reviewRequest()).toBeNull();
  });

  it('hides the breadcrumb and page heading when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('#location-change-approvals-heading')).toBeNull();
  });
});
