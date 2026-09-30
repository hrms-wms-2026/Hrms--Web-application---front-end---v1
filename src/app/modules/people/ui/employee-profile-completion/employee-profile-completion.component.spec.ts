import { TestBed } from '@angular/core/testing';
import { EmployeeProfileCompletionComponent } from './employee-profile-completion.component';

describe('EmployeeProfileCompletionComponent', () => {
  it('renders the percentage and marks each section complete or incomplete', () => {
    const fixture = TestBed.createComponent(EmployeeProfileCompletionComponent);
    fixture.componentRef.setInput('completion', {
      percent: 50,
      items: [
        { label: 'Basic Information', complete: true },
        { label: 'Address Information', complete: false }
      ]
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="profile-completion-text"]')?.textContent).toContain('50%');
    const items = Array.from(root.querySelectorAll('li'));
    expect(items.map((li) => li.getAttribute('data-complete'))).toEqual(['true', 'false']);
    expect(items[0].textContent).toContain('(complete)');
    expect(items[1].textContent).toContain('(incomplete)');
  });
});
