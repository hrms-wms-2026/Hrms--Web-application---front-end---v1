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

  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    result: TeamActionItemsResponse | 'error'
  ): Promise<ComponentFixture<ApprovalsExceptionsCardComponent>> {
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
    return fixture;
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
});
