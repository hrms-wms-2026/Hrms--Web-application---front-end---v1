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

  function history(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      positionName: `Role ${i + 1}`,
      departmentName: 'Engineering',
      effectiveFrom: `202${i}-01-01`,
      effectiveTo: i === count - 1 ? null : `202${i + 1}-01-01`,
      changeReason: i === 0 ? null : ('Promotion' as const),
      initiatedByName: 'Jane Doe',
      approvedByName: null
    }));
  }

  it('shows only the three most recent entries until popped out, then all of them', () => {
    // Reversed: the card sorts by date itself.
    fixture.componentRef.setInput('entries', history(5).reverse());
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    let rows = el.querySelectorAll('[data-testid="journey-entry"]');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Role 3');
    expect(rows[2].textContent).toContain('Role 5');
    expect(rows[2].textContent).toContain('Current');

    const toggle = el.querySelector('[data-testid="journey-toggle"]') as HTMLButtonElement;
    expect(toggle.textContent).toContain('View all (5)');
    toggle.click();
    fixture.detectChanges();

    rows = el.querySelectorAll('[data-testid="journey-entry"]');
    expect(rows.length).toBe(5);
    expect(rows[0].textContent).toContain('Initial recorded position');
  });

  it('has nothing to pop out with three entries or fewer', () => {
    fixture.componentRef.setInput('entries', history(3));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="journey-toggle"]')).toBeFalsy();
    (el.querySelector('[data-testid="career-journey-card"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showAll()).toBe(false);
  });
});
