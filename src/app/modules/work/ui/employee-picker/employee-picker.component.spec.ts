import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeePickerComponent } from './employee-picker.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../../people/models/employee.model';

describe('EmployeePickerComponent', () => {
  let fixture: ComponentFixture<EmployeePickerComponent>;
  let peopleApi: { listEmployees: ReturnType<typeof vi.fn> };

  const employees: EmployeeListItemResponse[] = [
    { id: 'e1', employeeNumber: 'EMP001', fullName: 'Asha Rao', email: 'asha@acme.test', departmentId: null, departmentName: 'Engineering', positionId: null, positionName: null, legalEntityId: 'le1', legalEntityName: 'Acme Inc', employmentTypeLabel: 'Full-time', status: 'active', reportingManagerId: null, reportingManagerName: null }
  ];

  beforeEach(async () => {
    peopleApi = { listEmployees: vi.fn().mockReturnValue(of({ items: employees, totalCount: 1, page: 1, pageSize: 20 })) };
    await TestBed.configureTestingModule({
      imports: [EmployeePickerComponent],
      providers: [{ provide: PeopleApiService, useValue: peopleApi }]
    }).compileComponents();
    fixture = TestBed.createComponent(EmployeePickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('loads and renders employees on open', () => {
    expect(peopleApi.listEmployees).toHaveBeenCalled();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="employee-picker-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Asha Rao');
  });

  it('re-queries with the search term when typed', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="employee-picker-search"]') as HTMLInputElement;
    input.value = 'asha';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(peopleApi.listEmployees).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'asha' }));
  });

  it('emits selected with the employee id when a row is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.selected.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="employee-picker-row"]') as HTMLElement).click();

    expect(spy).toHaveBeenCalledWith('e1');
  });

  it('emits closed when the close control is activated', () => {
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="employee-picker-close"]') as HTMLElement).click();

    expect(spy).toHaveBeenCalled();
  });
});
