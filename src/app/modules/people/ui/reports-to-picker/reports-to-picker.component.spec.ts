import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActiveHolder } from '../../models/onboarding-draft.model';
import { ReportsToPickerComponent } from './reports-to-picker.component';

describe('ReportsToPickerComponent', () => {
  let fixture: ComponentFixture<ReportsToPickerComponent>;
  const holders: ActiveHolder[] = [
    { employeeId: 'a', firstName: 'A', lastName: 'One', workEmail: 'a@acme.test', avatarFileId: null },
    { employeeId: 'b', firstName: 'B', lastName: 'Two', workEmail: 'b@acme.test', avatarFileId: null }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportsToPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReportsToPickerComponent);
    fixture.componentRef.setInput('holders', holders);
    fixture.detectChanges();
  });

  it('renders one option per holder', () => {
    const options = fixture.nativeElement.querySelectorAll('[data-testid="reports-to-option"]');
    expect(options.length).toBe(2);
  });

  it('emits selectedEmployeeIdChange when a holder is chosen', () => {
    const emitted: (string | null)[] = [];
    fixture.componentInstance.selectedEmployeeIdChange.subscribe((v: string | null) => emitted.push(v));

    const firstOption = fixture.nativeElement.querySelector('[data-testid="reports-to-option"]');
    firstOption.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['a']);
  });
});
