import { TestBed } from '@angular/core/testing';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import { StartOffboardingModalComponent } from './start-offboarding-modal.component';

describe('StartOffboardingModalComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [StartOffboardingModalComponent],
      providers: [{ provide: OffboardingWizardStore, useValue: { startOffboarding: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(StartOffboardingModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture;
  }

  it('limits the notes to the backend 4000 characters and says so', () => {
    const fixture = setup();
    const notes = fixture.componentInstance.form.controls.notes;
    const field = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-input')).find((el) =>
      el.textContent?.includes('Notes'),
    ) as HTMLElement;
    const input = field.querySelector('input, textarea') as HTMLInputElement;
    input.value = 'a'.repeat(4001);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(notes.errors).toEqual({ maxlength: { requiredLength: 4000, actualLength: 4001 } });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Notes must be 4000 characters or fewer.');
  });
});
