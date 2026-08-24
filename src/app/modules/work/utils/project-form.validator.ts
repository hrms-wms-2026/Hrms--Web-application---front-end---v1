export interface ProjectFormFields {
  name: string;
  identifier: string;
  categoryId: string;
  startDate: string;
  targetDate: string;
  releaseDate: string;
  allocatedHours: number;
}

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,19}$/;

export function validateProjectForm(
  fields: ProjectFormFields,
  mode: 'create' | 'edit'
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!fields.name.trim()) {
    errors['name'] = 'Name is required.';
  }
  if (!fields.categoryId.trim()) {
    errors['categoryId'] = 'Category is required.';
  }
  if (!fields.startDate) {
    errors['startDate'] = 'Start date is required.';
  }
  if (!fields.targetDate) {
    errors['targetDate'] = 'Target date is required.';
  } else if (fields.startDate && fields.targetDate < fields.startDate) {
    errors['targetDate'] = 'Target date cannot be before the start date.';
  }
  if (fields.allocatedHours < 0) {
    errors['allocatedHours'] = 'Allocated hours cannot be negative.';
  }

  if (mode === 'create') {
    if (!fields.identifier.trim()) {
      errors['identifier'] = 'Identifier is required.';
    } else if (!IDENTIFIER_PATTERN.test(fields.identifier)) {
      errors['identifier'] = 'Identifier must start with a letter and contain only letters/digits, max 20 characters.';
    }
    if (!fields.releaseDate) {
      errors['releaseDate'] = 'Release date is required.';
    }
  }

  return errors;
}
