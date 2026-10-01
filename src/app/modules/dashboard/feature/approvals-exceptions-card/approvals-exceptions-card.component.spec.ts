import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { ActionSourceSummary, TeamActionItemsResponse } from '../../models/my-team-action-items.model';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { ApprovalsExceptionsCardComponent } from './approvals-exceptions-card.component';

function source(overrides: Partial<ActionSourceSummary> = {}): ActionSourceSummary {
  return {
    sourceKey: 'leave.approval',
    domain: 'people',
    status: 'ok',
    pendingCount: 2,
    inProgressCount: null,
    oldestPendingAt: '2026-09-28T00:00:00Z',
    topItems: [],
    ...overrides
  };
}

describe('ApprovalsExceptionsCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let deepLinkNavigate: ReturnType<typeof vi.fn>;

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(
    result: TeamActionItemsResponse | 'error'
  ): Promise<ComponentFixture<ApprovalsExceptionsCardComponent>> {
    const { fixture } = await setupWithApi(result);
    return fixture;
  }

  async function setupWithApi(
    result: TeamActionItemsResponse | 'error'
  ): Promise<{ fixture: ComponentFixture<ApprovalsExceptionsCardComponent>; getActionItems: ReturnType<typeof vi.fn> }> {
    const getActionItems = vi.fn(() =>
      result === 'error' ? throwError(() => new Error('fail')) : of(result)
    );
    navigate = vi.fn();
    deepLinkNavigate = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ApprovalsExceptionsCardComponent],
      providers: [
        MyTeamActionItemsStore,
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems } },
        { provide: Router, useValue: { navigate } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: deepLinkNavigate } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ApprovalsExceptionsCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getActionItems };
  }

  it('shows the empty state when every source has zero pending', async () => {
    const fixture = await setup({ legalEntityId: 'le-1', sources: [source({ pendingCount: 0 })] });
    expect(fixture.nativeElement.textContent).toContain('Nothing is waiting for you');
  });

  it('groups sources under People I manage and Work I lead', async () => {
    const fixture = await setup({
      legalEntityId: 'le-1',
      sources: [source({ sourceKey: 'leave.approval', domain: 'people' }), source({ sourceKey: 'work.task_creation', domain: 'work', pendingCount: 1 })]
    });
    const peopleSection = fixture.nativeElement.querySelector('[data-testid="approvals-people-sources"]');
    const workSection = fixture.nativeElement.querySelector('[data-testid="approvals-work-sources"]');
    expect(peopleSection.textContent).toContain('Leave requests');
    expect(workSection.textContent).toContain('Task creation requests');
  });

  it('shows the pending count badge and oldest-waiting caption', async () => {
    const fixture = await setup({
      legalEntityId: 'le-1',
      sources: [source({ pendingCount: 3, oldestPendingAt: new Date(Date.now() - 2 * 3_600_000).toISOString() })]
    });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('3');
    expect(text).toContain('oldest waiting 2h');
  });

  it('shows "Couldn\'t load {source}" with a retry for an unavailable source', async () => {
    const fixture = await setup({
      legalEntityId: 'le-1',
      sources: [source({ status: 'unavailable', pendingCount: 0 })]
    });
    expect(fixture.nativeElement.textContent).toContain("Couldn't load Leave requests");
  });

  it('navigates People sources to their known list route on click', async () => {
    const fixture = await setup({
      legalEntityId: 'le-1',
      sources: [source({ sourceKey: 'attendance.correction', domain: 'people' })]
    });
    const row: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="approvals-people-sources"] button');
    row.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/attendance/time-tracking'], {
      queryParams: { view: 'team', type: 'corrections' }
    });
  });

  it('navigates Work sources via the deep link service using the oldest pending item', async () => {
    const link = { kind: 'work.request', params: { relatedEntityType: 'task_creation_request', relatedEntityId: 't1' } };
    const fixture = await setup({
      legalEntityId: 'le-1',
      sources: [source({
        sourceKey: 'work.task_creation', domain: 'work', pendingCount: 1,
        topItems: [{
          sourceKey: 'work.task_creation', entityId: 't1', title: 'New task - Fix bug',
          subjectEmployeeId: null, subjectName: 'Arjun M', createdAt: '2026-09-28T00:00:00Z',
          exceptionStatus: null, link
        }]
      })]
    });
    const row: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="approvals-work-sources"] button');
    row.click();
    await fixture.whenStable();
    expect(deepLinkNavigate).toHaveBeenCalledWith(link);
  });

  it('shows a critical severity dot for monitoring.exception when any item is Escalated', async () => {
    const fixture = await setup({
      legalEntityId: 'le-1',
      sources: [source({
        sourceKey: 'monitoring.exception', domain: 'people', pendingCount: 1,
        topItems: [{
          sourceKey: 'monitoring.exception', entityId: 'e1', title: 'Low activity', subjectEmployeeId: null,
          subjectName: 'Priya K', createdAt: '2026-09-28T00:00:00Z', exceptionStatus: 'Escalated',
          link: { kind: 'monitoring.exception', params: { alertId: 'e1' } }
        }]
      })]
    });
    const dot: HTMLElement = fixture.nativeElement.querySelector('.approvals-severity-dot--critical');
    expect(dot).toBeTruthy();
  });

  it('polls every 60 seconds while the document is visible', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { getActionItems } = await setupWithApi({ legalEntityId: 'le-1', sources: [] });
    expect(getActionItems).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getActionItems).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getActionItems).toHaveBeenCalledTimes(3);
  });

  it('stops polling while hidden and refetches immediately when visible again', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const { getActionItems } = await setupWithApi({ legalEntityId: 'le-1', sources: [] });
    expect(getActionItems).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(getActionItems).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getActionItems).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getActionItems).toHaveBeenCalledTimes(3);
  });

  it('removes the visibilitychange listener and clears the interval on destroy', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { fixture, getActionItems } = await setupWithApi({ legalEntityId: 'le-1', sources: [] });

    fixture.destroy();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    await vi.advanceTimersByTimeAsync(120_000);
    expect(getActionItems).toHaveBeenCalledTimes(1);
  });
});
