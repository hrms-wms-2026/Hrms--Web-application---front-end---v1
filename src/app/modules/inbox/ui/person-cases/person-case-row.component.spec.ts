import { TestBed } from '@angular/core/testing';
import { InboxItemDto, InboxPersonCaseDto } from '../../models/inbox.dto';
import { PersonCaseRowComponent, personCaseLabel } from './person-case-row.component';

function item(overrides: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'monitoring', kind: 'case', id: 'a', category: 'alert', actionType: 'IdentityAnomaly', title: 'Identity anomaly - Bala Kumar',
    subtitle: null, status: 'open', direction: 'info', severity: 'high', contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Bala Kumar' }, requestedTo: null, createdAt: '2026-10-05T09:00:00', updatedAt: '2026-10-05T09:00:00',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {},
    ...overrides
  };
}

describe('PersonCaseRowComponent', () => {
  function render(row: InboxPersonCaseDto) {
    TestBed.configureTestingModule({ imports: [PersonCaseRowComponent] });
    const fixture = TestBed.createComponent(PersonCaseRowComponent);
    fixture.componentRef.setInput('case', row);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('labels a row by its type, without the person\'s name', () => {
    expect(personCaseLabel(item())).toBe('Identity anomaly');
    expect(personCaseLabel(item({ title: 'Annual Leave - Bala Kumar', category: 'request' }))).toBe('Annual Leave');
    expect(personCaseLabel(item({ title: 'Odd title', requestedBy: null }))).toBe('Odd title');
  });

  it('shows icon, type, date and status - and no severity text', () => {
    const { el } = render({ item: item(), canOpen: true });

    expect(el.querySelector('[data-testid="pcr-type"]')!.textContent!.trim()).toBe('Identity anomaly');
    expect(el.querySelector('[data-testid="pcr-date"]')!.textContent!.trim()).toBe('5 Oct');
    expect(el.querySelector('[data-testid="pcr-status"]')!.textContent!.trim()).toBe('Open');
    expect(el.textContent).not.toContain('high');
  });

  it('colours the icon like the list: danger while a high alert is live, neutral once finished', () => {
    expect(render({ item: item(), canOpen: true }).el.querySelector('app-inbox-type-icon')!.classList).toContain('iti--danger');
    TestBed.resetTestingModule();
    expect(render({ item: item({ status: 'resolved', isPending: false }), canOpen: true }).el
      .querySelector('app-inbox-type-icon')!.classList).toContain('iti--neutral');
  });

  it('mutes a cancelled request', () => {
    const { el } = render({ item: item({ category: 'request', status: 'cancelled', isPending: false }), canOpen: true });

    expect(el.querySelector('.pcr')!.classList).toContain('pcr--muted');
  });

  it('emits open only when the caller can open the case', () => {
    const open = render({ item: item(), canOpen: true });
    const opened: unknown[] = [];
    open.fixture.componentInstance.open.subscribe((ref) => opened.push(ref));
    (open.el.querySelector('.pcr') as HTMLElement).click();
    expect(opened).toEqual([{ source: 'monitoring', kind: 'case', id: 'a' }]);

    TestBed.resetTestingModule();
    const locked = render({ item: item(), canOpen: false });
    const none: unknown[] = [];
    locked.fixture.componentInstance.open.subscribe((ref) => none.push(ref));
    (locked.el.querySelector('.pcr') as HTMLElement).click();
    expect(none).toEqual([]);
    expect((locked.el.querySelector('.pcr') as HTMLButtonElement).disabled).toBe(true);
  });
});
