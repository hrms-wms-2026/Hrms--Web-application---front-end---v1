import { isValidEmail } from '../../../shared/utils/validation.helpers';

export const ProfileValidators = {
  isValidEmail,

  /** UX-only format check - the backend is the validation authority per architecture-doc §6.4. */
  isValidPhone: (phone: string): boolean => /^[0-9+()\-\s]{7,20}$/.test(phone.trim())
};
