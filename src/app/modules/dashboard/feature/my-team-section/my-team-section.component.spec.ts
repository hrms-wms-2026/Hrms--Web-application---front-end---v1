import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamCapabilitiesApiService } from '../../data-access/my-team-capabilities-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { MyTeamCapabilitiesResponse } from '../../models/my-team-capabilities.model';
import { MyTeamSectionComponent } from './my-team-section.component';

const EMPTY_TODAY = { workDate: '2026-09-30', timezone: 'UTC', legalEntityId: 'le-1', summary: { total: 0, working: 0, onBreak: 0, clockedOut: 0, late: 0, absent: 0, notStarted: 0, onLeave: 0, notScheduled: 0, needsAttention: 0 }, members: [], totalMembers: 0 };
const EMPTY_ACTION_ITEMS = { legalEntityId: 'le-1', sources: [] };
const EMPTY_LED_PROGRESS = { totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 }, projects: [], overdueTasks: [], overdueTotal: 0 };

function capabilities(overrides: Partial<MyTeamCapabilitiesResponse> = {}): MyTeamCapabilitiesResponse {
  return {
    isAvailable: true, canViewPeopleStatus: false, canReviewPeopleApprovals: false,
    canReviewExceptions: false, hasWorkApprovals: false, leadsWork: false,
    canViewLiveActivity: false, legalEntityId: 'le-1',
    ...overrides
  };
}

describe('MyTeamSectionComponent', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  async function setup(caps: MyTeamCapabilitiesResponse | null): Promise<ComponentFixture<MyTeamSectionComponent>> {
    await TestBed.configureTestingModule({
      imports: [MyTeamSectionComponent],
      providers: [
        { provide: MyTeamCapabilitiesApiService, useValue: { getCapabilities: () => of(caps ?? capabilities({ isAvailable: false })) } },
        { provide: MyTeamTodayApiService, useValue: { getTeamToday: () => of(EMPTY_TODAY) } },
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems: () => of(EMPTY_ACTION_ITEMS) } },
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(EMPTY_LED_PROGRESS) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: vi.fn() } },
        { provide: AuthStore, useValue: { employeeId: () => null } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MyTeamSectionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing at all when no capability flag is true (AC-1)', async () => {
    const fixture = await setup(capabilities({ isAvailable: false }));
    expect(fixture.nativeElement.querySelector('[data-testid="my-team-section"]')).toBeNull();
    expect((fixture.nativeElement.textContent as string).trim()).toBe('');
  });

  it('renders the section heading and only the capability-allowed widgets', async () => {
    const fixture = await setup(capabilities({ isAvailable: true, canViewPeopleStatus: true }));
    expect(fixture.nativeElement.querySelector('[data-testid="my-team-section"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-team-status-card')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-team-progress-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-approvals-exceptions-card')).toBeNull();
  });

  it('hides the Customize control when only one widget is allowed', async () => {
    const fixture = await setup(capabilities({ isAvailable: true, canViewPeopleStatus: true }));
    expect(fixture.nativeElement.querySelector('[data-testid="my-team-customize-toggle"]')).toBeNull();
  });

  it('shows the Customize control and opens the picker when more than one widget is allowed', async () => {
    const fixture = await setup(capabilities({ isAvailable: true, canViewPeopleStatus: true, leadsWork: true }));
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="my-team-customize-toggle"]');
    expect(toggle).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="my-team-picker"]')).toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="my-team-picker"]')).toBeTruthy();
  });

  function findRowButton(fixture: ComponentFixture<MyTeamSectionComponent>, rowText: string, action: 'Hide' | 'Show'): HTMLButtonElement {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="my-team-picker"] > div > div'));
    const row = rows.find((r) => r.textContent?.includes(rowText));
    const button = row?.querySelector('button') as HTMLButtonElement | undefined;
    if (!button || button.textContent?.trim() !== action) {
      throw new Error(`Expected a "${action}" button in the row for "${rowText}"`);
    }
    return button;
  }

  it('hiding a widget via the picker removes it from the grid and persists the choice', async () => {
    const fixture = await setup(capabilities({ isAvailable: true, canViewPeopleStatus: true, leadsWork: true }));
    fixture.nativeElement.querySelector('[data-testid="my-team-customize-toggle"]').click();
    fixture.detectChanges();

    findRowButton(fixture, 'Team Status', 'Hide').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-team-status-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-team-progress-card')).toBeTruthy();
    expect(localStorage.getItem('onexso.my_team_widget_order')).toContain('teamProgress');
    expect(localStorage.getItem('onexso.my_team_widget_order')).not.toContain('teamStatus');
  });

  it('re-showing a hidden widget via the picker restores it to the grid', async () => {
    const fixture = await setup(capabilities({ isAvailable: true, canViewPeopleStatus: true, leadsWork: true }));
    fixture.nativeElement.querySelector('[data-testid="my-team-customize-toggle"]').click();
    fixture.detectChanges();
    findRowButton(fixture, 'Team Status', 'Hide').click();
    fixture.detectChanges();

    findRowButton(fixture, 'Team Status', 'Show').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-team-status-card')).toBeTruthy();
  });
});
