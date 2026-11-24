import { FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from '../../../core/errors/api-error';
import { applyServerFieldErrors, failedSaveToast } from './server-errors';
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

  describe('failedSaveToast', () => {
    const http = (status: number, body?: unknown) => toApiError(new HttpErrorResponse({ status, error: body }), 'Failed to save.');

    it('gives the fallback when there is no error to read', () => {
      expect(failedSaveToast(null, 'Failed to save.')).toBe('Failed to save.');
    });

    it('gives null when the form shows the field errors', () => {
      expect(failedSaveToast(http(400, { errors: { Name: ['Name is required.'] } }), 'Failed to save.')).toBeNull();
    });

    it('gives the backend message for a refusal with no field errors', () => {
      expect(failedSaveToast(http(409, { detail: 'Code already used.' }), 'Failed to save.')).toBe('Code already used.');
    });

    it.each([500, 503, 0, 403, 429, 418])('gives null for %i, which the error handler already toasted', (status) => {
      expect(failedSaveToast(http(status), 'Failed to save.')).toBeNull();
    });

    it('gives the message of an error that did not come from HTTP', () => {
      expect(failedSaveToast(toApiError(new Error('x'), 'Failed to save.'), 'Failed to save.')).toBe(toApiError(new Error('x'), 'Failed to save.').message);
    });
  });
});
