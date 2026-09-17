import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmployeeListItemResponse } from '../../models/employee.model';
import { EmployeeListViewComponent } from './employee-list-view.component';

describe('EmployeeListViewComponent', () => {
  let fixture: ComponentFixture<EmployeeListViewComponent>;

  const employee: EmployeeListItemResponse = {
    id: 'emp-1',
    employeeNumber: 'E-001',
    fullName: 'Ada Lovelace',
    email: 'ada@test.dev',
    departmentId: 'dept-1',
    departmentName: 'Engineering',
    positionId: 'pos-1',
    positionName: 'Software Engineer',
    legalEntityId: 'le-1',
    legalEntityName: 'Acme Co',
    employmentTypeLabel: 'Full-time',
    status: 'active',
    reportingManagerId: 'mgr-1',
    reportingManagerName: 'Grace Hopper'
  };

  async function setup(employees: readonly EmployeeListItemResponse[]) {
    await TestBed.configureTestingModule({
      imports: [EmployeeListViewComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeListViewComponent);
    fixture.componentRef.setInput('employees', employees);
    fixture.detectChanges();
  }

  it('renders the empty state when there are no employees', async () => {
    await setup([]);
    expect(fixture.nativeElement.textContent).toContain('No employees found');
  });

  it('renders employee card rows with details', async () => {
    await setup([employee]);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('E-001');
    expect(text).toContain('Software Engineer');
    expect(text).toContain('Engineering');
    expect(text).toContain('Full-time');
    expect(text).toContain('Grace Hopper');
  });
});
