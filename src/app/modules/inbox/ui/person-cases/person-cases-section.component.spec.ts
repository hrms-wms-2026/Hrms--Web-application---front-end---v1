import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxItemDto, InboxPersonCaseDto } from '../../models/inbox.dto';
import { InboxPersonCasesStore } from '../../state/inbox-person-cases.store';
import { PersonCasesSectionComponent } from './person-cases-section.component';

function item(overrides: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'monitoring', kind: 'case', id: 'cur', category: 'alert', actionType: 'IdentityAnomaly', title: 'Identity anomaly - Bala',
    subtitle: null, status: 'open', direction: 'received', severity: 'high', contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: null, createdAt: '2026-10-15T12:00:00', updatedAt: '2026-10-15T12:00:00',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {},
    ...overrides
  };
}

const rows = (n: number): InboxPersonCaseDto[] =>
  Array.from({ length: n }, (_, i) => ({ item: item({ id: `r${i}`, createdAt: `2026-10-0${(i % 9) + 1}T09:00:00` }), canOpen: true }));

describe('PersonCasesSectionComponent', () => {
  async function render(cases: InboxPersonCaseDto[], current: InboxItemDto = item(), self = 'me') {
    const api = { personCases: vi.fn(() => of(cases)), personCaseMonths: vi.fn(() => of({ hireDate: null, months: [] })) };
    TestBed.configureTestingModule({
      imports: [PersonCasesSectionComponent],
      providers: [InboxPersonCasesStore, { provide: InboxApiService, useValue: api }]
    });
    const store = TestBed.inject(InboxPersonCasesStore);
    await store.load(current, self);
    const fixture = TestBed.createComponent(PersonCasesSectionComponent);
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, store };
  }

  it('shows 5 rows and View all (N) when the month holds more', async () => {
    const { el, store } = await render(rows(7));

    expect(el.querySelectorAll('app-person-case-row')).toHaveLength(5);
    const more = el.querySelector('[data-testid="pcs-view-all"]') as HTMLButtonElement;
    expect(more.textContent!.trim()).toBe('View all (7)');
    more.click();
    expect(store.viewOpen()).toBe(true);
  });

  it('shows the empty line and View history for an empty month', async () => {
    const { el } = await render([]);

    expect(el.querySelector('[data-testid="pcs-empty"]')!.textContent!.trim()).toBe('No other cases this month');
    expect(el.querySelector('[data-testid="pcs-view-all"]')!.textContent!.trim()).toBe('View history');
  });

  it('renders nothing when hidden', async () => {
    const { el } = await render(rows(2), item(), 'e1');

    expect(el.querySelector('[data-testid="person-cases"]')).toBeNull();
  });
});
