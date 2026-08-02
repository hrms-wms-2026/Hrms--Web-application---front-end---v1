import { isValidEmail } from './validation.helpers';

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects a string with no @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects a string with no domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});
