import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceStore } from './leave-balance.store';
describe('LeaveBalanceStore', () => { let store: InstanceType<typeof LeaveBalanceStore>; let http: HttpTestingController; beforeEach(() => { TestBed.configureTestingModule({ providers: [LeaveBalanceStore, provideHttpClient(), provideHttpClientTesting()] }); store = TestBed.inject(LeaveBalanceStore); http = TestBed.inject(HttpTestingController); }); afterEach(() => http.verify()); it('loads personal balances', async () => { const work = store.loadMy(2026); http.expectOne(`${environment.apiUrl}/leave/balances/my?year=2026`).flush([]); await work; expect(store.my()).toEqual([]); expect(store.myLoading()).toBe(false); }); it('reloads team balances after changing filters', async () => { const work = store.loadTeam(2026); http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026`).flush([]); await work; store.setTeamFilters({ search: 'anu' }); http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026&search=anu`).flush([]); await Promise.resolve(); expect(store.teamFilters().search).toBe('anu'); });

  it('sets myError on a failed loadMy', async () => {
    const work = store.loadMy(2026);
    http.expectOne(`${environment.apiUrl}/leave/balances/my?year=2026`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await work;
    expect(store.myError()).toBeTruthy();
    expect(store.myLoading()).toBe(false);
  });

  it('sets teamError on a failed loadTeam', async () => {
    const work = store.loadTeam(2026);
    http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await work;
    expect(store.teamError()).toBeTruthy();
    expect(store.teamLoading()).toBe(false);
  });

  it('loads all balances into state', async () => {
    const work = store.loadAll(2026);
    http.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/all`).flush([]);
    await work;
    expect(store.all()).toEqual([]);
    expect(store.allLoading()).toBe(false);
  });

  it('sets allError on a failed loadAll', async () => {
    const work = store.loadAll(2026);
    http.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/all`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await work;
    expect(store.allError()).toBeTruthy();
    expect(store.allLoading()).toBe(false);
  });
});

