import { TestBed } from '@angular/core/testing';
import { EmployeeWorkArrangementComponent } from './employee-work-arrangement.component';

describe('EmployeeWorkArrangementComponent', () => {
  function render(workModeLabel: string | null, legalEntityName: string | null, primaryLocation: string) {
    TestBed.configureTestingModule({ imports: [EmployeeWorkArrangementComponent] });
    const fixture = TestBed.createComponent(EmployeeWorkArrangementComponent);
    fixture.componentRef.setInput('workModeLabel', workModeLabel);
    fixture.componentRef.setInput('legalEntityName', legalEntityName);
    fixture.componentRef.setInput('primaryLocation', primaryLocation);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows work mode, legal entity and primary location', () => {
    const el = render('Hybrid', 'Dapi Technologies', 'Colombo, Sri Lanka');

    expect(el.textContent).toContain('Work Arrangement');
    expect(el.textContent).toContain('Hybrid');
    expect(el.textContent).toContain('Dapi Technologies');
    expect(el.textContent).toContain('Colombo, Sri Lanka');
  });

  it('falls back to an em dash for missing values', () => {
    const el = render(null, null, 'Not specified');

    expect(el.querySelectorAll('[data-testid="value"]')[0]?.textContent?.trim()).toBe('—');
    expect(el.querySelectorAll('[data-testid="value"]')[1]?.textContent?.trim()).toBe('—');
  });
});
