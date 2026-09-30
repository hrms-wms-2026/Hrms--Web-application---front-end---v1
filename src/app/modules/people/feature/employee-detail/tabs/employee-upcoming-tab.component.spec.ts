import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { EmployeeUpcomingTabComponent } from './employee-upcoming-tab.component';

describe('EmployeeUpcomingTabComponent', () => {
  it('renders the placeholder title and description from route data', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { placeholderTitle: 'Attendance insights are coming soon', placeholderDescription: 'Monthly view.' } } }
        }
      ]
    });
    const fixture = TestBed.createComponent(EmployeeUpcomingTabComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Attendance insights are coming soon');
    expect(text).toContain('Monthly view.');
  });
});
