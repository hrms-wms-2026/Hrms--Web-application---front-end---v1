import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeListFilters, EMPTY_EMPLOYEE_FILTERS } from '../../utils/employee-list-url-state';
import { EmployeeFilterPopoverComponent } from './employee-filter-popover.component';

@Component({
  standalone: true,
  imports: [EmployeeFilterPopoverComponent],
  template: `<app-employee-filter-popover [value]="value()" [legalEntityId]="le()" (applied)="applied.push($event)" />`
})
class HostComponent {
  value = signal<EmployeeListFilters>({ ...EMPTY_EMPLOYEE_FILTERS, departmentId: 'd1' });
  le = signal<string | null>('le-1');
  applied: EmployeeListFilters[] = [];
}

async function setup() {
  const departments = { listFlat: vi.fn(() => of({ items: [{ id: 'd1', name: 'Engineering' }] })) };
  const positions = { listFlat: vi.fn(() => of({ items: [{ id: 'p1', name: 'Engineer' }] })) };
  const people = { listEmployees: vi.fn(() => of({ items: [{ id: 'm1', fullName: 'Boss' }], totalCount: 1, page: 1, pageSize: 100 })) };
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      { provide: DepartmentApiService, useValue: departments },
      { provide: PositionApiService, useValue: positions },
      { provide: PeopleApiService, useValue: people }
    ]
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(id: string) => el.querySelector(`[data-testid="${id}"]`) as T | null;
  const open = () => { q('filter-trigger')!.click(); fixture.detectChanges(); };
  return { fixture, q, open, host: fixture.componentInstance, departments, positions, people };
}

describe('EmployeeFilterPopoverComponent', () => {
  it('shows the active filter count on the trigger', async () => {
    const { q } = await setup();
    expect(q('filter-count')!.textContent!.trim()).toBe('1');
  });

  it('loads options for the selected company once when opened', async () => {
    const { open, departments, positions, people } = await setup();
    open(); open(); open();
    expect(departments.listFlat).toHaveBeenCalledTimes(1);
    expect(departments.listFlat).toHaveBeenCalledWith('le-1', expect.objectContaining({ pageSize: 100 }));
    expect(positions.listFlat).toHaveBeenCalledWith('le-1', expect.objectContaining({ includeInactive: false }));
    expect(people.listEmployees).toHaveBeenCalledWith(expect.objectContaining({ legalEntityId: 'le-1', pageSize: 100 }));
  });

  it('adds employment type on demand and emits updated filters on selection', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q('filter-add-btn')!.click();
    fixture.detectChanges();

    q('filter-picker-employmentTypes')!.click();
    fixture.detectChanges();

    const row = q('filter-row-employmentTypes')!;
    const dropdownTrigger = row.querySelector('.work-dropdown__trigger') as HTMLElement;
    dropdownTrigger.click();
    fixture.detectChanges();

    q('dropdown-option-contract')!.click();
    fixture.detectChanges();

    expect(host.applied).toContainEqual({
      departmentId: 'd1',
      positionId: null,
      employmentTypes: ['contract'],
      managerId: null
    });
  });

  it('Clear all resets active filters and emits empty filters', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q('filter-reset')!.click();
    fixture.detectChanges();
    expect(host.applied).toEqual([EMPTY_EMPLOYEE_FILTERS]);
  });

  it('removing a filter field clears it and emits updated filters', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q('filter-remove-departmentId')!.click();
    fixture.detectChanges();
    expect(host.applied).toContainEqual({
      departmentId: null,
      positionId: null,
      employmentTypes: [],
      managerId: null
    });
  });

  it('without a selected company shows a hint and does not call company-scoped APIs', async () => {
    const { fixture, q, open, host, departments } = await setup();
    host.le.set(null);
    fixture.detectChanges();
    open();
    expect(q('filter-no-company')).not.toBeNull();
    expect(departments.listFlat).not.toHaveBeenCalled();
  });
});
