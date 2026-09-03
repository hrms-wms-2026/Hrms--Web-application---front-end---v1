import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { DependentsPanelComponent } from './dependents-panel.component';
import { Dependent } from '../../models/profile.model';

const dependents: Dependent[] = [
  { id: '1', name: 'Sam Doe', relationship: 'child', dateOfBirth: '2015-06-01', isEmergencyContact: false, phone: null }
];

describe('DependentsPanelComponent', () => {
  it('lists existing dependents', async () => {
    await TestBed.configureTestingModule({ imports: [DependentsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(DependentsPanelComponent);
    fixture.componentRef.setInput('dependents', dependents);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sam Doe');
  });

  it('emits add with form values and isEmergencyContact false by default', async () => {
    await TestBed.configureTestingModule({ imports: [DependentsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(DependentsPanelComponent);
    fixture.componentRef.setInput('dependents', []);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    fixture.componentInstance.addForm.setValue({
      name: 'New Dependent',
      relationship: 'child',
      dateOfBirth: '2020-01-01',
      phone: ''
    });

    let emitted: unknown;
    fixture.componentInstance.add.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmitAdd();

    expect((emitted as { name: string; isEmergencyContact: boolean }).name).toBe('New Dependent');
    expect((emitted as { isEmergencyContact: boolean }).isEmergencyContact).toBe(false);
  });

  it('does not expose an emergency-contact checkbox in the add form', async () => {
    await TestBed.configureTestingModule({ imports: [DependentsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(DependentsPanelComponent);
    fixture.componentRef.setInput('dependents', []);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeFalsy();
  });
});
