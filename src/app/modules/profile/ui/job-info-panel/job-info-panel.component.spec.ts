import { TestBed } from '@angular/core/testing';
import { JobInfoPanelComponent } from './job-info-panel.component';
import { JobInformation } from '../../models/profile.model';

const sampleJobInfo: JobInformation = {
  employeeNumber: 'EMP-001', legalEntityName: 'Acme Corp', departmentName: 'Engineering',
  positionName: 'Software Engineer', reportingManagerName: 'Alex Manager',
  employmentTypeLabel: 'Full-time', employmentStatus: 'active',
  hireDate: '2024-01-15', probationEndDate: null, workMode: 'remote'
};

describe('JobInfoPanelComponent', () => {
  it('renders job information fields as read-only text, no form controls', async () => {
    await TestBed.configureTestingModule({ imports: [JobInfoPanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(JobInfoPanelComponent);
    fixture.componentRef.setInput('jobInformation', sampleJobInfo);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Software Engineer');
    expect(fixture.nativeElement.textContent).toContain('Alex Manager');
    expect(fixture.nativeElement.querySelectorAll('input, select, textarea, button[type="submit"]').length).toBe(0);
  });
});
