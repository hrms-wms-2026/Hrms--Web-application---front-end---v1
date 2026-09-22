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

  function setup(items = employees, currentEmployeeId: string | null = null) {
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
    fixture.detectChanges();
  }

  it('queries employees when opened', () => {
    setup();
    expect(peopleApi.listEmployees).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 20 });
  });

  it('renders a row per result with the already-selected one marked', () => {
    setup();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute('data-selected')).toBe('true');
    expect(rows[1].getAttribute('data-selected')).toBe('false');
  });

  it('emits selectedIdsChange with the toggled id added', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.selectedIdsChange.subscribe(spy);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    rows[1].click();
    expect(spy).toHaveBeenCalledWith(['emp-1', 'emp-2']);
  });

  it('emits selectedIdsChange with the toggled id removed when already selected', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.selectedIdsChange.subscribe(spy);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    rows[0].click();
    expect(spy).toHaveBeenCalledWith([]);
  });

  it('excludes the current user from the results - you cannot add yourself as a participant of your own event', () => {
    const withSelf = [
      ...employees,
      { id: 'emp-me', fullName: 'Current User', email: 'me@example.com', departmentName: 'Engineering' }
    ];
    setup(withSelf, 'emp-me');

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain('Current User');
  });

  it('still shows every result when the current employee id is unknown', () => {
    setup(employees, null);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    expect(rows.length).toBe(2);
  });
});
