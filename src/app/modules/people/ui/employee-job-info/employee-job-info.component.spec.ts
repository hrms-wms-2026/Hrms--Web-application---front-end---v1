import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeJobInfoComponent } from './employee-job-info.component';
import { EmployeeDetailJobInformation } from '../../models/employee.model';

describe('EmployeeJobInfoComponent', () => {
  let fixture: ComponentFixture<EmployeeJobInfoComponent>;

  const jobInfo: EmployeeDetailJobInformation = {
    employeeNumber: 'E-100', legalEntityId: 'le-1', legalEntityName: 'Acme Inc', departmentName: 'Engineering',
    positionName: 'Senior Engineer', positionId: 'pos-1', reportingManagerName: 'Jane Doe',
    employmentTypeLabel: 'Full-time', status: 'active', hireDate: '2026-01-01', probationEndDate: null,
    workModeLabel: 'Remote'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmployeeJobInfoComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmployeeJobInfoComponent);
    fixture.componentRef.setInput('jobInformation', jobInfo);
    fixture.detectChanges();
  });

  it('renders the position and department', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Senior Engineer');
    expect(text).toContain('Engineering');
  });

  it('shows a fallback for missing optional fields', async () => {
    fixture.componentRef.setInput('jobInformation', { ...jobInfo, positionName: null, departmentName: null, legalEntityName: null, reportingManagerName: null });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Unassigned');
  });

  it('renders the work mode', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Work Mode');
    expect(text).toContain('Remote');
  });

  it('shows a fallback when work mode is not resolved', () => {
    fixture.componentRef.setInput('jobInformation', { ...jobInfo, workModeLabel: null });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('—');
  });
});
