import { describe, expect, it } from 'vitest';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { PEOPLE_ROUTES } from './people.routes';

describe('PEOPLE_ROUTES', () => {
  it('the employee list route is protected by the unsaved-changes guard', () => {
    const employees = PEOPLE_ROUTES.flatMap((r) => [r, ...(r.children ?? [])]).find((r) => r.path === 'employees');
    expect(employees?.canDeactivate).toBeDefined();
    expect(employees?.canDeactivate).toContain(unsavedChangesGuard);
  });
});
