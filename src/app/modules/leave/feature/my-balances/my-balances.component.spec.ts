import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { environment } from '../../../../../environments/environment';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { MyBalancesComponent, summarizeBalances } from './my-balances.component';

const ANNUAL: LeaveBalanceResponse = {
  employeeId: 'emp-1',
  employeeNumber: 'EMP-001',
  employeeName: 'Anu Raman',
  departmentId: null,
  departmentName: null,
  legalEntityId: null,
  legalEntityName: null,
  leaveTypeId: 'type-1',
  leaveTypeName: 'Annual Leave',
  leaveTypeCode: 'ANNUAL',
  year: 2026,
  entitledDays: 20,
  annualDays: 20,
  carriedForwardDays: 2,
  usedDays: 4,
  pendingDays: 1,
  remainingDays: 17,
  isNegative: false,
  carryForwardExpiresOn: '2026-12-31'
};

describe('MyBalancesComponent', () => {
  let fixture: ComponentFixture<MyBalancesComponent>;
  let httpMock: HttpTestingController;

  async function setup(permissions: string[], view?: string): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MyBalancesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(view ? { view } : {}) }
          }
        }
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    patchState(TestBed.inject(AuthStore) as Parameters<typeof patchState>[0], { permissions });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(MyBalancesComponent);
  }

  afterEach(() => httpMock.verify());

  it('loads balances and my requests on init', async () => {
    await setup(['leave:read-own']);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
  });

  it('opens the new-request wizard when the button is clicked', async () => {
    await setup(['leave:read-own']);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="new-request-button"]');
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.wizardOpen()).toBe(true);
  });

  it('hides the MY/TEAM switcher for employees without leave:read-team', async () => {
    await setup(['leave:read-own']);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    expect(fixture.nativeElement.querySelector('[data-testid="balances-view-toggle"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Balances');
  });

  it('shows the MY/TEAM switcher when the user can read own and team balances', async () => {
    await setup(['leave:read-own', 'leave:read-team']);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    expect(fixture.nativeElement.querySelector('[data-testid="balances-view-toggle"]')).toBeTruthy();
  });

  it('renders leave-type cards and a remaining total on the My view', async () => {
    await setup(['leave:read-own']);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([ANNUAL]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(LeaveBalanceStore).my()).toEqual([ANNUAL]);
    const card = fixture.nativeElement.querySelector('[data-testid="balance-row"]') as HTMLElement | null;
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain('Annual Leave');
    expect(fixture.nativeElement.querySelector('[data-testid="summary-remaining"]')?.textContent).toContain('17.0');
    expect(fixture.nativeElement.querySelector('[data-testid="balance-remaining"]')?.textContent).toContain('17.0');
  });

  it('loads team balances when TEAM is selected', async () => {
    await setup(['leave:read-own', 'leave:read-team']);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.selectViewMode('team');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/team`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Balances');
    expect(fixture.nativeElement.querySelector('[data-testid="balances-view-team"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('[data-testid="team-balances-search"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="new-request-button"]')).toBeNull();
  });

  it('opens on team view when the user only has leave:read-team', async () => {
    await setup(['leave:read-team']);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/team`).flush([]);
    expect(fixture.componentInstance.viewMode()).toBe('team');
    expect(fixture.nativeElement.querySelector('[data-testid="balances-view-toggle"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="team-balances-search"]')).toBeTruthy();
  });

  it('opens on team view when deep-linked with ?view=team', async () => {
    await setup(['leave:read-own', 'leave:read-team'], 'team');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/team`).flush([]);
    expect(fixture.componentInstance.viewMode()).toBe('team');
  });
});

describe('summarizeBalances', () => {
  it('sums remaining, pending, used, and entitled days', () => {
    expect(summarizeBalances([ANNUAL, { ...ANNUAL, leaveTypeId: 'type-2', remainingDays: 3, pendingDays: 0, usedDays: 2, entitledDays: 5 }])).toEqual({
      remaining: 20,
      pending: 1,
      used: 6,
      entitled: 25,
      types: 2
    });
  });
});
