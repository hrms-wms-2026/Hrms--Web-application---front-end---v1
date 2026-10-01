import { TestBed } from '@angular/core/testing';
import { MonitorWarningCalloutComponent } from './monitor-warning-callout.component';

describe('MonitorWarningCalloutComponent', () => {
  function render(warnings: { code: string; message: string }[]) {
    TestBed.configureTestingModule({ imports: [MonitorWarningCalloutComponent] });
    const fixture = TestBed.createComponent(MonitorWarningCalloutComponent);
    fixture.componentRef.setInput('warnings', warnings);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders nothing without warnings', () => {
    expect(render([]).querySelector('[data-testid="monitor-warnings"]')).toBeNull();
  });

  it('lists each warning and says saving is still allowed', () => {
    const element = render([
      { code: 'module_over_capacity', message: 'Allocated 500 h, but 5 member(s) can produce at most 400 h.' },
      { code: 'employee_deadline_overload', message: 'Kaja has 30 h of work due by Oct 7.' }
    ]);

    const callout = element.querySelector('[data-testid="monitor-warnings"]')!;
    expect(callout.getAttribute('role')).toBe('status');
    expect(callout.textContent).toContain('you can still save');
    expect(callout.querySelectorAll('li').length).toBe(2);
  });
});
