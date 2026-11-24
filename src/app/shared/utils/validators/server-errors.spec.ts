import { FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from '../../../core/errors/api-error';
import { applyServerFieldErrors } from './server-errors';
import { fieldError, validationMessage } from './validation-messages';

function badRequest(errors: Record<string, string[]>) {
  return toApiError(new HttpErrorResponse({ status: 400, error: { title: 'Validation Error', errors } }));
}

describe('applyServerFieldErrors', () => {
  const form = () => new FormGroup({ name: new FormControl('Acme'), companyCode: new FormControl('AC'), addresses: new FormControl(null) });

  it('puts a backend field message on the matching control and shows it', () => {
    const f = form();
    const leftover = applyServerFieldErrors(f, badRequest({ Name: ['Company name must be 200 characters or fewer.'] }));
    expect(leftover).toBeNull();
    expect(f.controls.name.errors).toEqual({ server: { message: 'Company name must be 200 characters or fewer.' } });
    expect(fieldError(f.controls.name, 'Company name')).toBe('Company name must be 200 characters or fewer.');
  });

  it('maps a nested backend key to its top-level control', () => {
    const f = form();
    applyServerFieldErrors(f, badRequest({ 'Addresses[0].AddressType': ['Address type must be permanent or current.'] }));
    expect(f.controls.addresses.errors).toEqual({ server: { message: 'Address type must be permanent or current.' } });
  });

  it('returns the message of a key that matches no control, for a form-level message', () => {
    const f = form();
    expect(applyServerFieldErrors(f, badRequest({ LegalEntityId: ['Legal entity ID is required.'] }))).toBe('Legal entity ID is required.');
  });

  it('keeps other errors on the control and clears the server one when the value changes', () => {
    const f = form();
    applyServerFieldErrors(f, badRequest({ CompanyCode: ['Company code already used.'] }));
    expect(f.controls.companyCode.errors).toEqual({ server: { message: 'Company code already used.' } });
    f.controls.companyCode.setValue('AC2');
    expect(f.controls.companyCode.errors).toBeNull();
  });

  it('shows the server text as it is', () => {
    expect(validationMessage({ server: { message: 'Already used.' } }, 'Code')).toBe('Already used.');
  });

  it('returns the message for a disabled control, which cannot show it', () => {
    const f = new FormGroup({ defaultLanguage: new FormControl({ value: 'en-US', disabled: true }) });
    expect(applyServerFieldErrors(f, badRequest({ DefaultLanguage: ['Default language must be 10 characters or fewer.'] }))).toBe(
      'Default language must be 10 characters or fewer.',
    );
  });
});
