import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeListItemResponse } from '../../models/employee.model';
import { EmployeeTableComponent } from './employee-table.component';

describe('EmployeeTableComponent', () => {
  let fixture: ComponentFixture<EmployeeTableComponent>;

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
      imports: [EmployeeTableComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeTableComponent);
    fixture.componentRef.setInput('employees', employees);
    fixture.detectChanges();
  }

  it('renders the empty state when there are no employees', async () => {
    await setup([]);
    expect(fixture.nativeElement.textContent).toContain('No employees found');
  });

  it('renders employee rows with resolved names, not raw ids', async () => {
    await setup([employee]);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Software Engineer');
    expect(text).toContain('Engineering');
    expect(text).toContain('Acme Co');
    expect(text).toContain('Grace Hopper');
    expect(text).not.toContain('emp-1');
    expect(text).not.toContain('pos-1');
  });

  it('shows "Unassigned" rather than a blank cell when there is no reporting manager', async () => {
    await setup([{ ...employee, reportingManagerId: null, reportingManagerName: null }]);
    expect(fixture.nativeElement.textContent).toContain('Unassigned');
  });

  it('attaches routerLink to employee row and does not render Actions column or View link', async () => {
    await setup([employee]);
    const linkDe = fixture.debugElement.query(By.directive(RouterLink));
    expect(linkDe).not.toBeNull();
    expect(linkDe.nativeElement.classList.contains('emp-row')).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Actions');
    expect(fixture.nativeElement.querySelector('.emp-view-link')).toBeNull();
  });

  it('renders green status dot for active employee and red status dot for inactive employee on profile avatar', async () => {
    await setup([employee, { ...employee, id: 'emp-2', status: 'inactive' }]);

    const activeDot = fixture.nativeElement.querySelector('.emp-status-dot-avatar--active');
    expect(activeDot).not.toBeNull();

    const inactiveDot = fixture.nativeElement.querySelector('.emp-status-dot-avatar--inactive');
    expect(inactiveDot).not.toBeNull();

    expect(fixture.nativeElement.querySelector('.col-status')).toBeNull();
  });
});
