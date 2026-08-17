import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeJobJourneyComponent } from './employee-job-journey.component';

describe('EmployeeJobJourneyComponent', () => {
  let fixture: ComponentFixture<EmployeeJobJourneyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeJobJourneyComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeJobJourneyComponent);
  });

  it('renders entries oldest first, with no reason badge on the hire entry', () => {
    fixture.componentRef.setInput('entries', [
      {
        positionName: 'Senior Engineer',
        departmentName: 'Engineering',
        effectiveFrom: '2024-02-01',
        effectiveTo: '2026-08-16',
        changeReason: null,
        initiatedByName: 'System',
        approvedByName: null
      },
      {
        positionName: 'Head of Security',
        departmentName: 'Security',
        effectiveFrom: '2026-08-17',
        effectiveTo: null,
        changeReason: 'Promotion',
        initiatedByName: 'Jane Doe',
        approvedByName: 'John Smith'
      }
    ]);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="journey-entry"]');
    expect(rows[0].textContent).toContain('Senior Engineer');
    expect(rows[0].textContent).not.toContain('Promotion');
    expect(rows[1].textContent).toContain('Promotion');
    expect(rows[1].textContent).toContain('Approved by John Smith');
  });

  it('shows Present instead of an end date for the current entry', () => {
    fixture.componentRef.setInput('entries', [
      {
        positionName: 'Head of Security',
        departmentName: 'Security',
        effectiveFrom: '2026-08-17',
        effectiveTo: null,
        changeReason: 'Promotion',
        initiatedByName: 'Jane Doe',
        approvedByName: null
      }
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent as string).toContain('Present');
  });
});
