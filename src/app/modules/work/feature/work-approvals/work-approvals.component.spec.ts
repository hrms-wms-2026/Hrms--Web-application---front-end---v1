import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkApprovalsComponent } from './work-approvals.component';
import { WorkDropdownComponent } from '../../ui/work-dropdown/work-dropdown.component';
import { DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { ApprovalExplanationCardComponent } from '../../ui/approval-explanation-card/approval-explanation-card.component';
import { FilterBarComponent } from '../../../../shared/ui/filter-bar/filter-bar.component';
import { WorkApprovalsStore } from '../../state/work-approvals.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ApprovalDetailDto, ApprovalFeedItemDto } from '../../models/dto/approval-feed.dto';
import { sortFeed } from '../../utils/approval-feed.util';

function feedItem(overrides: Partial<ApprovalFeedItemDto> = {}): ApprovalFeedItemDto {
  return {
    id: 'r1', source: 'engine', actionType: 'task.edit', targetType: 'task', targetId: 't1', targetTitle: 'Audit',
    moduleId: 'm1', moduleTitle: 'Payments', projectName: 'Apollo', status: 'pending', direction: 'received',
    requestedById: 'e1', requestedByName: 'Bala', approverId: 'e2', approverName: 'Anu', decidedById: null,
    decidedByName: null, decisionComment: null, createdAt: '2026-09-29T10:24:00Z', decidedAt: null,
    canDecide: true, canCancel: false, commentCount: 0, summary: null, ...overrides
  };
}

describe('WorkApprovalsComponent', () => {
  let fixture: ComponentFixture<WorkApprovalsComponent>;
  let store: any;
  let approvalsApi: any;
  let projectApi: any;
  let router: any;
  let toolbar: any;
  let notifications: any;

  const received = feedItem({ id: 'received-1' });
  const sent = feedItem({ id: 'sent-1', direction: 'sent', canDecide: false, canCancel: true, createdAt: '2026-09-30T08:00:00Z' });
  const decided = feedItem({ id: 'decided-1', status: 'approved', canDecide: false, createdAt: '2026-09-30T09:00:00Z' });

  function setup(options: {
    items?: ApprovalFeedItemDto[]; query?: Record<string, string>; createAllocationRequest?: any; storeProjectId?: string
  } = {}): void {
    const items = signal(sortFeed(options.items ?? [decided, received, sent]));
    const detail = signal<ApprovalDetailDto | null>(null);
    const selectedId = signal<string | null>(null);
    store = {
      items, detail, selectedId,
      loading: signal(false), error: signal<string | null>(null), projectId: signal(options.storeProjectId ?? 'project-1'),
      detailLoading: signal(false), detailError: signal<string | null>(null),
      comments: signal([]), commentsLoading: signal(false), busy: signal(false),
      loadAll: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockImplementation(async (item: ApprovalFeedItemDto | null) => {
        selectedId.set(item?.id ?? null);
        detail.set(item ? {
          item, requestedPayloadJson: '{}', appliedPayloadJson: null, fields: [], canEditPayload: false,
          note: null, currentAllocatedHours: null, invitation: null, canRevert: false, revertableUntil: null
        } : null);
      }),
      approve: vi.fn().mockResolvedValue(true),
      reject: vi.fn().mockResolvedValue(true),
      cancel: vi.fn().mockResolvedValue(true),
      revert: vi.fn().mockResolvedValue(true),
      addComment: vi.fn(), reply: vi.fn(), editComment: vi.fn()
    };
    approvalsApi = { createAllocationRequest: options.createAllocationRequest ?? vi.fn().mockReturnValue(of({})) };
    projectApi = {
      getMyMilestones: vi.fn().mockReturnValue(of([
        { objectiveId: 'obj-1', title: 'Module One', isOwner: true },
        { objectiveId: 'obj-2', title: 'Module Two', isOwner: false }
      ]))
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    toolbar = { setTemplate: vi.fn() };
    notifications = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    const query = options.query ?? {};

    TestBed.configureTestingModule({
      imports: [WorkApprovalsComponent],
      providers: [
        { provide: WorkApprovalsStore, useValue: store },
        { provide: WorkApprovalsApiService, useValue: approvalsApi },
        { provide: ProjectApiService, useValue: projectApi },
        { provide: WorkPageToolbarStore, useValue: toolbar },
        { provide: NotificationService, useValue: notifications },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => key === 'id' ? 'project-1' : null },
              queryParamMap: { get: (key: string) => query[key] ?? null }
            },
            parent: null
          }
        }
      ]
    });
    fixture = TestBed.createComponent(WorkApprovalsComponent);
    fixture.detectChanges();
  }

  const table = () => fixture.debugElement.query(By.directive(DataTableComponent)).componentInstance as DataTableComponent<ApprovalFeedItemDto>;
  const tableIds = () => table().rows().map((i) => i.id);

  it('registers the toolbar template and relies on the shell-loaded feed', async () => {
    setup();
    await fixture.whenStable();
    expect(toolbar.setTemplate).toHaveBeenCalledWith(expect.anything());
    expect(store.loadAll).not.toHaveBeenCalled();
    expect(projectApi.getMyMilestones).toHaveBeenCalledWith('project-1');
    // No page heading: the sub-menu tab already names the page.
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
  });

  it('loads the feed itself when the store holds another project', () => {
    setup({ storeProjectId: 'other-project' });
    expect(store.loadAll).toHaveBeenCalledWith('project-1');
  });

  it('passes the sorted, filtered items to the table', () => {
    setup();
    expect(tableIds()).toEqual(['sent-1', 'received-1', 'decided-1']);
  });

  it('the Requests filter "sent" hides received rows', () => {
    setup();
    const filterBar = fixture.debugElement.query(By.directive(FilterBarComponent));
    // The filter bar lives in the toolbar template, so drive the page handler directly when it is not rendered here.
    if (filterBar) {
      (filterBar.componentInstance as FilterBarComponent).fieldChanged.emit({ key: 'direction', values: ['sent'] });
    } else {
      (fixture.componentInstance as any).onFilterChanged({ key: 'direction', values: ['sent'] });
    }
    fixture.detectChanges();
    expect(tableIds()).toEqual(['sent-1']);

    (fixture.componentInstance as any).onFilterChanged({ key: 'status', values: ['approved'] });
    (fixture.componentInstance as any).onFilterChanged({ key: 'direction', values: ['all'] });
    fixture.detectChanges();
    expect(tableIds()).toEqual(['decided-1']);
  });

  it('selecting a row loads the detail, sets ?request= and shows the card', () => {
    setup();
    table().rowClicked.emit(received);
    fixture.detectChanges();

    expect(store.select).toHaveBeenCalledWith(received);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { request: 'received-1', tab: null }, queryParamsHandling: 'merge', replaceUrl: true
    }));
    expect(fixture.debugElement.query(By.directive(ApprovalExplanationCardComponent))).not.toBeNull();
  });

  it('selects the first visible request by default', () => {
    setup();
    expect(store.select).toHaveBeenLastCalledWith(sent);
    expect(fixture.debugElement.query(By.directive(ApprovalExplanationCardComponent))).not.toBeNull();
  });

  it('selects the first visible request again when a filter hides the selected one', () => {
    setup();
    table().rowClicked.emit(decided);
    fixture.detectChanges();
    (fixture.componentInstance as any).onFilterChanged({ key: 'status', values: ['pending'] });
    fixture.detectChanges();
    expect(store.select).toHaveBeenLastCalledWith(sent);
  });

  it('?request=<id> on load selects that item', () => {
    setup({ query: { request: 'decided-1' } });
    fixture.detectChanges();
    expect(store.select).toHaveBeenCalledWith(decided);
  });

  it('quick approve calls store.approve without an edited payload and toasts', async () => {
    setup();
    fixture.componentInstance.onRowMenu(received, 'approve');
    await fixture.whenStable();
    expect(store.approve).toHaveBeenCalledWith(received);
    expect(notifications.success).toHaveBeenCalledWith('Approved');
  });

  it("the card's reject with no reason calls store.reject(item, undefined)", () => {
    setup();
    table().rowClicked.emit(received);
    fixture.detectChanges();
    const card = fixture.debugElement.query(By.directive(ApprovalExplanationCardComponent)).componentInstance as ApprovalExplanationCardComponent;

    card.reject.emit(null);
    expect(store.reject).toHaveBeenCalledWith(received, undefined);

    card.approve.emit('{"Title":"B"}');
    expect(store.approve).toHaveBeenCalledWith(received, '{"Title":"B"}');
  });

  it('closing the card clears the selection and the query param', () => {
    setup();
    table().rowClicked.emit(received);
    fixture.detectChanges();
    (fixture.debugElement.query(By.directive(ApprovalExplanationCardComponent)).componentInstance as ApprovalExplanationCardComponent).closed.emit();
    fixture.detectChanges();

    expect(store.select).toHaveBeenLastCalledWith(null);
    expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { request: null, tab: null } }));
  });

  it('opening a module target navigates to its tree', () => {
    setup();
    fixture.componentInstance.onRowMenu(feedItem({ targetType: 'module', targetId: 'obj-9' }), 'open');
    expect(router.navigate).toHaveBeenCalledWith(['/work', 'project-1', 'milestones', 'obj-9', 'tree']);
  });

  it('shows the project-empty message when there are no requests at all', () => {
    setup({ items: [] });
    expect(fixture.nativeElement.textContent).toContain('No approval requests in this project yet.');
  });

  it('opens the Create Approval modal with the loaded module options', async () => {
    setup();
    await fixture.whenStable();
    fixture.componentInstance.openCreateApproval();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="create-approval-modal"]')).not.toBeNull();
    const dropdown = fixture.debugElement.queryAll(By.directive(WorkDropdownComponent))
      .map((d) => d.componentInstance as WorkDropdownComponent)
      .find((d) => d.fieldLabel() === 'Module')!;
    expect(dropdown.options().map((option) => option.label)).toEqual(['Module One', 'Module Two']);
  });

  it('validates the create form', async () => {
    setup();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;
    component.openCreateApproval();
    await component.submitCreateApproval();

    expect(component.createErrors()).toEqual({
      module: 'Select a module.', hours: 'Hours must be greater than zero.', reason: 'Reason is required.'
    });
    expect(approvalsApi.createAllocationRequest).not.toHaveBeenCalled();
  });

  it('submits a create allocation request and reloads approvals on success', async () => {
    setup();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;
    component.openCreateApproval();
    component.createModuleId.set('obj-1');
    component.createHours.set('12');
    component.createReason.set('Need more delivery capacity');

    await component.submitCreateApproval();

    expect(approvalsApi.createAllocationRequest).toHaveBeenCalledWith('obj-1', {
      requestedAdditionalHours: 12,
      reason: 'Need more delivery capacity'
    });
    expect(store.loadAll).toHaveBeenCalledWith('project-1');
    expect(component.createOpen()).toBe(false);
  });

  it('shows an alert when creating an allocation request fails', async () => {
    setup({ createAllocationRequest: vi.fn().mockReturnValue(throwError(() => ({ error: { detail: 'A change request is already pending.' } }))) });
    await fixture.whenStable();
    const component = fixture.componentInstance as any;
    component.openCreateApproval();
    component.createModuleId.set('obj-1');
    component.createHours.set('12');
    component.createReason.set('Need more delivery capacity');

    await component.submitCreateApproval();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="create-approval-modal"] [role="alert"]')?.textContent).toContain('already pending');
  });
});
