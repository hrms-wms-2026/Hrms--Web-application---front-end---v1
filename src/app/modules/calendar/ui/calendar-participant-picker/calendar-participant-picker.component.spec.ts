import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarParticipantPickerComponent } from './calendar-participant-picker.component';

describe('CalendarParticipantPickerComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarParticipantPickerComponent>>;
  let peopleApi: { listEmployees: ReturnType<typeof vi.fn> };

  const employees = [
    { id: 'emp-1', fullName: 'Ada Lovelace', email: 'ada@example.com', departmentName: 'Engineering' },
    { id: 'emp-2', fullName: 'Grace Hopper', email: 'grace@example.com', departmentName: 'Engineering' }
  ];

  function setup(items = employees, currentEmployeeId: string | null = null, guestEmails: string[] = []) {
    peopleApi = { listEmployees: vi.fn().mockReturnValue(of({ items, totalCount: items.length, page: 1, pageSize: 20 })) };
    TestBed.configureTestingModule({
      imports: [CalendarParticipantPickerComponent],
      providers: [
        { provide: PeopleApiService, useValue: peopleApi },
        { provide: AuthStore, useValue: { employeeId: () => currentEmployeeId } }
      ]
    });
    fixture = TestBed.createComponent(CalendarParticipantPickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('selectedIds', ['emp-1']);
    fixture.componentRef.setInput('guestEmails', guestEmails);
    fixture.detectChanges();
  }

  const rows = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="people-picker-row"]'));

  function type(value: string): void {
    const input = fixture.nativeElement.querySelector('[data-testid="people-picker-search"]') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('queries employees when opened', () => {
    setup();
    expect(peopleApi.listEmployees).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 20, activeOnly: true });
  });

  it('renders a row per result with the already-selected one marked', () => {
    setup();
    expect(rows().length).toBe(2);
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true');
    expect(rows()[1].getAttribute('aria-pressed')).toBe('false');
    expect(rows()[0].textContent).toContain('ada@example.com');
    expect(rows()[0].textContent).toContain('Engineering');
  });

  it('emits selectedIdsChange with the toggled id added', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.selectedIdsChange.subscribe(spy);
    rows()[1].click();
    expect(spy).toHaveBeenCalledWith(['emp-1', 'emp-2']);
  });

  it('emits selectedIdsChange with the toggled id removed when already selected', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.selectedIdsChange.subscribe(spy);
    rows()[0].click();
    expect(spy).toHaveBeenCalledWith([]);
  });

  it('lists the current user first as "(You)" so they can add themselves, but never pre-selects them', () => {
    const withSelf = [
      ...employees,
      { id: 'emp-me', fullName: 'Current User', email: 'me@example.com', departmentName: 'Engineering' }
    ];
    setup(withSelf, 'emp-me');

    expect(rows().length).toBe(3);
    expect(rows()[0].textContent).toContain('Current User (You)');
    expect(rows()[0].getAttribute('aria-pressed')).toBe('false');

    const spy = vi.fn();
    fixture.componentInstance.selectedPeopleChange.subscribe(spy);
    rows()[0].click();
    expect(spy).toHaveBeenCalledWith([{ id: 'emp-1', name: 'Ada Lovelace' }, { id: 'emp-me', name: 'Current User' }]);
  });

  it('still offers the current user first when they are not on the first page of results', () => {
    const me = { id: 'emp-me', fullName: 'Current User', email: 'me@example.com', departmentName: 'Engineering' };
    const listEmployees = vi.fn((req: { search: string }) =>
      of(req.search === 'me@example.com'
        ? { items: [me], totalCount: 1, page: 1, pageSize: 5 }
        : { items: employees, totalCount: 2, page: 1, pageSize: 20 }));
    TestBed.configureTestingModule({
      imports: [CalendarParticipantPickerComponent],
      providers: [
        { provide: PeopleApiService, useValue: { listEmployees } },
        { provide: AuthStore, useValue: { employeeId: () => 'emp-me', email: () => 'me@example.com' } }
      ]
    });
    fixture = TestBed.createComponent(CalendarParticipantPickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(rows().length).toBe(3);
    expect(rows()[0].textContent).toContain('Current User (You)');
  });

  it('recognises the current user by login email when the session has no employee id', () => {
    const withSelf = [
      ...employees,
      { id: 'emp-me', fullName: 'Current User', email: 'Me@Example.com', departmentName: 'Engineering' }
    ];
    peopleApi = { listEmployees: vi.fn().mockReturnValue(of({ items: withSelf, totalCount: 3, page: 1, pageSize: 20 })) };
    TestBed.configureTestingModule({
      imports: [CalendarParticipantPickerComponent],
      providers: [
        { provide: PeopleApiService, useValue: peopleApi },
        { provide: AuthStore, useValue: { employeeId: () => null, email: () => 'me@example.com' } }
      ]
    });
    fixture = TestBed.createComponent(CalendarParticipantPickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(rows()[0].textContent).toContain('Current User (You)');
  });

  it('still shows every result when the current employee id is unknown', () => {
    setup(employees, null);
    expect(rows().length).toBe(2);
  });

  it('searches the server with what was typed, ignoring a leading @', () => {
    setup();
    peopleApi.listEmployees.mockClear();

    type('@gra');

    expect(peopleApi.listEmployees).toHaveBeenCalledWith({ search: 'gra', page: 1, pageSize: 20, activeOnly: true });
  });

  it('offers to invite a typed email that is not an employee and emits guestEmailsChange when chosen', () => {
    setup([]);
    const spy = vi.fn();
    fixture.componentInstance.guestEmailsChange.subscribe(spy);
    type('vendor@example.com');

    (fixture.nativeElement.querySelector('[data-testid="people-picker-invite"]') as HTMLElement).click();

    expect(spy).toHaveBeenCalledWith(['vendor@example.com']);
  });

  it('appends to the guests already chosen and does not add the same address twice', () => {
    setup([], null, ['first@example.com']);
    const spy = vi.fn();
    fixture.componentInstance.guestEmailsChange.subscribe(spy);

    fixture.componentInstance.addGuest('second@example.com');
    fixture.componentInstance.addGuest('first@example.com');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(['first@example.com', 'second@example.com']);
  });

  it('shows chosen guests and removes one when it is clicked', () => {
    setup([], null, ['first@example.com', 'second@example.com']);
    const spy = vi.fn();
    fixture.componentInstance.guestEmailsChange.subscribe(spy);

    const guestRows = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="people-picker-guest-row"]')) as HTMLElement[];
    expect(guestRows.length).toBe(2);
    guestRows[0].click();

    expect(spy).toHaveBeenCalledWith(['second@example.com']);
  });

  it('does not offer a guest invite for an email that belongs to a listed employee', () => {
    setup();
    type('grace@example.com');

    expect(fixture.nativeElement.querySelector('[data-testid="people-picker-invite"]')).toBeNull();
  });
});
