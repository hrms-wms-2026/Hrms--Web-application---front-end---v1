import { TestBed } from '@angular/core/testing';
import { PeoplePickerComponent, PeoplePickerOption } from './people-picker.component';

const PEOPLE: readonly PeoplePickerOption[] = [
  { id: 'e1', name: 'Kiru Balachandran', email: 'kiru@dapi.test', detail: 'Hardware Integration' },
  { id: 'e2', name: 'Saif Ahamed', email: 'saif@dapi.test', detail: 'Watercraft Engineering' }
];

describe('PeoplePickerComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PeoplePickerComponent>>;

  function el<T extends HTMLElement>(testId: string): T | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }
  function all(testId: string): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`));
  }
  function type(value: string): void {
    const input = el<HTMLInputElement>('people-picker-search')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PeoplePickerComponent] });
    fixture = TestBed.createComponent(PeoplePickerComponent);
    fixture.componentRef.setInput('options', PEOPLE);
    fixture.detectChanges();
  });

  it('renders each person with name, email and detail', () => {
    const rows = all('people-picker-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Kiru Balachandran');
    expect(rows[0].textContent).toContain('kiru@dapi.test');
    expect(rows[0].textContent).toContain('Hardware Integration');
  });

  it('marks selected people with a check and reflects it in aria-pressed', () => {
    fixture.componentRef.setInput('selectedIds', ['e2']);
    fixture.detectChanges();

    const rows = all('people-picker-row');
    expect(rows[0].getAttribute('aria-pressed')).toBe('false');
    expect(rows[1].getAttribute('aria-pressed')).toBe('true');
    expect(rows[1].querySelector('[data-testid="people-picker-check"]')).not.toBeNull();
    expect(rows[0].querySelector('[data-testid="people-picker-check"]')).toBeNull();
  });

  it('emits toggled with the id when a row is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.toggled.subscribe(spy);

    all('people-picker-row')[1].click();

    expect(spy).toHaveBeenCalledWith('e2');
  });

  it('emits searchChange as the user types, stripping a leading @ mention marker', () => {
    const spy = vi.fn();
    fixture.componentInstance.searchChange.subscribe(spy);

    type('kir');
    type('@sai');

    expect(spy.mock.calls.map((c) => c[0])).toEqual(['kir', 'sai']);
  });

  it('shows the empty text when there are no people and no guests', () => {
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('emptyText', 'Nobody here');
    fixture.detectChanges();

    expect(el('people-picker-empty')?.textContent).toContain('Nobody here');
  });

  describe('guests by email', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('allowGuests', true);
      fixture.detectChanges();
    });

    it('offers to invite a typed email that matches nobody', () => {
      type('Vendor@Example.com');

      const invite = el('people-picker-invite');
      expect(invite).not.toBeNull();
      expect(invite!.textContent).toContain('vendor@example.com');
    });

    it('emits guestAdded with the normalized email and clears the search when the invite row is clicked', () => {
      const added = vi.fn();
      const searched = vi.fn();
      fixture.componentInstance.guestAdded.subscribe(added);
      fixture.componentInstance.searchChange.subscribe(searched);
      type('  Vendor@Example.com ');

      el('people-picker-invite')!.click();
      fixture.detectChanges();

      expect(added).toHaveBeenCalledWith('vendor@example.com');
      expect(searched).toHaveBeenLastCalledWith('');
      expect(el<HTMLInputElement>('people-picker-search')!.value).toBe('');
    });

    it('does not offer a guest invite when the email belongs to a listed person', () => {
      type('kiru@dapi.test');

      expect(el('people-picker-invite')).toBeNull();
    });

    it('does not offer a guest invite for an address that is already a guest', () => {
      fixture.componentRef.setInput('guests', ['vendor@example.com']);
      fixture.detectChanges();
      type('vendor@example.com');

      expect(el('people-picker-invite')).toBeNull();
    });

    it.each(['vendor', 'vendor@', '@example.com', 'a b@example.com', 'vendor@example'])('does not offer an invite for %s', (text) => {
      type(text);

      expect(el('people-picker-invite')).toBeNull();
    });

    it('lists chosen guests with a Guest badge and emits guestToggled to remove one', () => {
      fixture.componentRef.setInput('guests', ['vendor@example.com']);
      fixture.detectChanges();
      const spy = vi.fn();
      fixture.componentInstance.guestToggled.subscribe(spy);

      const row = all('people-picker-guest-row')[0];
      expect(row.textContent).toContain('vendor@example.com');
      expect(row.textContent).toContain('Guest');
      row.click();

      expect(spy).toHaveBeenCalledWith('vendor@example.com');
    });
  });

  it('never offers a guest invite while allowGuests is off', () => {
    type('vendor@example.com');

    expect(el('people-picker-invite')).toBeNull();
  });
});
