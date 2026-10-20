import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxCategory, InboxItemDto, InboxPersonCaseDto } from '../../models/inbox.dto';
import { InboxPersonCasesStore } from '../../state/inbox-person-cases.store';
import { localMonthBounds } from '../../utils/person-cases.util';
import { PersonCasesViewComponent } from './person-cases-view.component';

function item(overrides: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'monitoring', kind: 'case', id: 'cur', category: 'alert', actionType: 'IdentityAnomaly', title: 'Identity anomaly - Bala',
    subtitle: null, status: 'open', direction: 'received', severity: 'high', contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: null, createdAt: '2026-10-15T12:00:00', updatedAt: '2026-10-15T12:00:00',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {},
    ...overrides
  };
}

describe('PersonCasesViewComponent', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 9, 19, 10) }));
  afterEach(() => vi.useRealTimers());

  /** `alerts` come back for the alert category; requests are always empty. */
  async function render(alerts: InboxPersonCaseDto[] = []) {
    const api = {
      personCases: vi.fn((_: string, category: InboxCategory) => of(category === 'alert' ? alerts : [])),
      personCaseMonths: vi.fn(() => of({ hireDate: '2025-06-01', months: [{ month: 4, count: 1 }] }))
    };
    TestBed.configureTestingModule({
      imports: [PersonCasesViewComponent],
      providers: [InboxPersonCasesStore, { provide: InboxApiService, useValue: api }]
    });
    const store = TestBed.inject(InboxPersonCasesStore);
    await store.load('e1', 'Bala', 'me');
    const fixture = TestBed.createComponent(PersonCasesViewComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
    return { fixture, el, store, api, q };
  }

  it('heads the view with the person and this month - every type, no Back', async () => {
    const { q } = await render();

    expect(q('pcv-back')).toBeNull();
    expect(q('pcv-person').textContent!.trim()).toBe('Bala');
    expect(q('pcv-category').textContent!.trim()).toBe('Requests and alerts');
    expect(q('pcv-month').textContent!.trim()).toBe('October 2026');
  });

  it('the previous arrow loads September for both kinds; next is disabled in the current month', async () => {
    const { q, api } = await render();

    expect(q('pcv-next').disabled).toBe(true);
    q('pcv-prev').click();
    await vi.advanceTimersByTimeAsync(0);

    const { from, to } = localMonthBounds(2026, 9);
    expect(api.personCases).toHaveBeenCalledWith('e1', 'alert', from, to);
    expect(api.personCases).toHaveBeenCalledWith('e1', 'request', from, to);
  });

  it('the month label opens the grid with dots, and a pick loads that month', async () => {
    const { fixture, el, q, store } = await render();

    q('pcv-month').click();
    fixture.detectChanges();
    expect(el.querySelector('app-person-case-month-grid')).not.toBeNull();
    expect(el.querySelectorAll('.pcg__dot')).toHaveLength(1);

    (el.querySelector('[data-month="4"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect([store.year(), store.month()]).toEqual([2026, 4]);
    expect(el.querySelector('app-person-case-month-grid')).toBeNull();
  });

  it('lists the month’s rows, or the empty line', async () => {
    const withRows = await render([{ item: item({ id: 'a' }), canOpen: true }]);
    expect(withRows.el.querySelectorAll('app-person-case-row')).toHaveLength(1);

    TestBed.resetTestingModule();
    const empty = await render([]);
    expect(empty.q('pcv-empty').textContent!.trim()).toBe('No cases this month');
  });
});
