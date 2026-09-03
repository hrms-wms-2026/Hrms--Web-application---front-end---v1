import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceStore } from './leave-balance.store';
describe('LeaveBalanceStore', () => { let store: InstanceType<typeof LeaveBalanceStore>; let http: HttpTestingController; beforeEach(() => { TestBed.configureTestingModule({ providers: [LeaveBalanceStore, provideHttpClient(), provideHttpClientTesting()] }); store = TestBed.inject(LeaveBalanceStore); http = TestBed.inject(HttpTestingController); }); afterEach(() => http.verify()); it('loads personal balances', async () => { const work = store.loadMy(2026); http.expectOne(`${environment.apiUrl}/leave/balances/my?year=2026`).flush([]); await work; expect(store.my()).toEqual([]); expect(store.myLoading()).toBe(false); }); it('reloads team balances after changing filters', async () => { const work = store.loadTeam(2026); http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026`).flush([]); await work; store.setTeamFilters({ search: 'anu' }); http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026&search=anu`).flush([]); await Promise.resolve(); expect(store.teamFilters().search).toBe('anu'); }); });

