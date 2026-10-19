import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxItemDto, InboxPersonCaseDto } from '../../models/inbox.dto';
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

  async function render(cases: InboxPersonCaseDto[] = []) {
    const api = {
      personCases: vi.fn(() => of(cases)),
      personCaseMonths: vi.fn(() => of({ hireDate: '2025-06-01', months: [{ month: 4, count: 1 }] }))
    };
    TestBed.configureTestingModule({
      imports: [PersonCasesViewComponent],
      providers: [InboxPersonCasesStore, { provide: InboxApiService, useValue: api }]
    });
    const store = TestBed.inject(InboxPersonCasesStore);
    await store.load(item(), 'me');
    await store.openView();
    const fixture = TestBed.createComponent(PersonCasesViewComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
    return { fixture, el, store, api, q };
  }

  it('heads the view with Back, the person, the category and the month', async () => {
    const { q } = await render();

    expect(q('pcv-back')).not.toBeNull();
    expect(q('pcv-person').textContent!.trim()).toBe('Bala');
    expect(q('pcv-category').textContent!.trim()).toBe('Alerts');
    expect(q('pcv-month').textContent!.trim()).toBe('October 2026');
  });

  it('Back closes the view', async () => {
    const { q, store } = await render();

    q('pcv-back').click();

    expect(store.viewOpen()).toBe(false);
  });

  it('the previous arrow loads September; next is disabled in the current month', async () => {
    const { q, api } = await render();

    expect(q('pcv-next').disabled).toBe(true);
    q('pcv-prev').click();
    await vi.advanceTimersByTimeAsync(0);

    const { from, to } = localMonthBounds(2026, 9);
    expect(api.personCases).toHaveBeenLastCalledWith('e1', 'alert', from, to);
  });

  it('the month label opens the grid with red dots, and a pick loads that month', async () => {
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
    expect(empty.q('pcv-empty').textContent!.trim()).toBe('No other cases this month');
  });
});
