import { ProfileValidators } from './profile-validators';

describe('ProfileValidators', () => {
  it('accepts a plausible phone number', () => {
    expect(ProfileValidators.isValidPhone('+94 77 123 4567')).toBe(true);
  });

  it('rejects an obviously invalid phone number', () => {
    expect(ProfileValidators.isValidPhone('abc')).toBe(false);
  });
});
