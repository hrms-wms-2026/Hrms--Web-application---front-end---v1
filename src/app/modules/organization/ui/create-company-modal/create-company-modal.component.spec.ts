import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CreateLegalEntityRequest } from '../../models/legal-entity.model';
import { CreateCompanyModalComponent } from './create-company-modal.component';

describe('CreateCompanyModalComponent', () => {
  async function setup(availableParents: readonly { id: string; name: string }[] = []) {
    await TestBed.configureTestingModule({
      imports: [CreateCompanyModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateCompanyModalComponent);
    fixture.componentRef.setInput('availableParents', availableParents);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture };
  }

  function fillValidForm(fixture: ReturnType<typeof TestBed.createComponent<CreateCompanyModalComponent>>): void {
    fixture.componentInstance.form.setValue({
      name: '  Acme Co  ',
      companyCode: '  ACME  ',
      registrationNumber: '  REG-1  ',
      countryCode: 'LKA',
      currencyCode: 'LKR',
      taxRegistrationNumber: '   ',
      parentLegalEntityId: ''
    });
  }

  it('renders the dialog with accessibility attributes', async () => {
    const { fixture } = await setup();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('moves focus into the dialog on open', async () => {
    const { fixture } = await setup();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
  });

  it('emits cancel on Escape keydown', async () => {
    const { fixture } = await setup();
    const cancelSpy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('emits cancel when the Cancel button is clicked', async () => {
    const { fixture } = await setup();
    const cancelSpy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.trim() === 'Cancel')?.click();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('does not emit save and marks fields touched when required fields are empty', async () => {
    const { fixture } = await setup();
    const saveSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);

    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.name.touched).toBe(true);
  });

  it('trims values and converts blank optional fields to null on submit', async () => {
    const { fixture } = await setup();
    let emitted: CreateLegalEntityRequest | undefined;
    fixture.componentInstance.save.subscribe((v: CreateLegalEntityRequest) => (emitted = v));

    fillValidForm(fixture);
    fixture.componentInstance.onSubmit();

    expect(emitted).toEqual({
      name: 'Acme Co',
      companyCode: 'ACME',
      registrationNumber: 'REG-1',
      countryCode: 'LKA',
      currencyCode: 'LKR',
      taxRegistrationNumber: null,
      parentLegalEntityId: null
    });
  });

  it('includes the selected parent company id when chosen', async () => {
    const { fixture } = await setup([{ id: 'parent-1', name: 'Parent Co' }]);
    let emitted: CreateLegalEntityRequest | undefined;
    fixture.componentInstance.save.subscribe((v: CreateLegalEntityRequest) => (emitted = v));

    fillValidForm(fixture);
    fixture.componentInstance.form.controls.parentLegalEntityId.setValue('parent-1');
    fixture.componentInstance.onSubmit();

    expect(emitted?.parentLegalEntityId).toBe('parent-1');
  });

  it('renders parent options built from availableParents, plus a top-level default', async () => {
    const { fixture } = await setup([{ id: 'parent-1', name: 'Parent Co' }]);
    const options = fixture.componentInstance.parentOptions;

    expect(options[0].value).toBe('');
    expect(options).toContainEqual({ value: 'parent-1', label: 'Parent Co' });
  });

  it('disables the submit button and shows a spinner while saving', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitButton?.disabled).toBe(true);
  });

  it('ignores submit while saving even if invoked directly', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    const saveSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);

    fillValidForm(fixture);
    fixture.componentInstance.onSubmit();

    expect(saveSpy).not.toHaveBeenCalled();
  });
});
