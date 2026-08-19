import { validateProjectForm, ProjectFormFields } from './project-form.validator';

describe('validateProjectForm', () => {
  const validCreateFields: ProjectFormFields = {
    name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', startDate: '2026-08-01',
    targetDate: '2026-12-01', releaseDate: '2026-11-15', allocatedHours: 40
  };

  it('returns no errors for a fully valid create-mode form', () => {
    expect(validateProjectForm(validCreateFields, 'create')).toEqual({});
  });

  it('requires name', () => {
    const errors = validateProjectForm({ ...validCreateFields, name: '' }, 'create');
    expect(errors['name']).toBeTruthy();
  });

  it('requires categoryId', () => {
    const errors = validateProjectForm({ ...validCreateFields, categoryId: '' }, 'create');
    expect(errors['categoryId']).toBeTruthy();
  });

  it('requires identifier only in create mode, and rejects a bad format', () => {
    expect(validateProjectForm({ ...validCreateFields, identifier: '' }, 'create')['identifier']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, identifier: '1WEB' }, 'create')['identifier']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, identifier: 'THIS-IDENTIFIER-IS-WAY-TOO-LONG' }, 'create')['identifier']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, identifier: '' }, 'edit')['identifier']).toBeUndefined();
  });

  it('rejects targetDate before startDate', () => {
    const errors = validateProjectForm({ ...validCreateFields, startDate: '2026-12-01', targetDate: '2026-08-01' }, 'create');
    expect(errors['targetDate']).toBeTruthy();
  });

  it('rejects negative allocatedHours', () => {
    const errors = validateProjectForm({ ...validCreateFields, allocatedHours: -1 }, 'create');
    expect(errors['allocatedHours']).toBeTruthy();
  });

  it('requires releaseDate only in create mode', () => {
    expect(validateProjectForm({ ...validCreateFields, releaseDate: '' }, 'create')['releaseDate']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, releaseDate: '' }, 'edit')['releaseDate']).toBeUndefined();
  });
});
