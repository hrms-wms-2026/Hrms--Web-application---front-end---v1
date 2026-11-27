import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoleFormModalComponent, RoleFormSubmitValue } from './role-form-modal.component';
import { ModulePermissionGroup, RoleDetailResponse, RoleSummaryResponse } from '../../models/role.model';
import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from '../../../../core/errors/api-error';

describe('RoleFormModalComponent', () => {
  let fixture: ComponentFixture<RoleFormModalComponent>;
  let component: RoleFormModalComponent;

  const catalog: ModulePermissionGroup[] = [
    {
      module: 'activity_monitoring',
      moduleTitle: 'Activity Monitoring',
      permissions: [
        { id: 'p-mon-read', code: 'monitoring:read', description: 'View monitoring data.', module: 'activity_monitoring', isAssignable: true, isUniversal: false },
        { id: 'p-mon-config', code: 'monitoring:configure', description: 'Enable/disable monitoring features.', module: 'activity_monitoring', isAssignable: true, isUniversal: false }
      ]
    },
    {
      module: 'leave',
      moduleTitle: 'Leave',
      permissions: [
        { id: 'p-leave-read', code: 'leave:read', description: 'View leave', module: 'leave', isAssignable: true, isUniversal: false }
      ]
    }
  ];

  const summary = (id: string, isSystem: boolean, permissionCount = 2): RoleSummaryResponse => ({
    id,
    name: isSystem ? 'General Manager' : 'Auditor',
    description: 'Role description',
    isSystem,
    permissionCount,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null,
    sourceTemplateId: null
  });

  function detail(id: string, permissionIds: string[]): RoleDetailResponse {
    const all = [
      { id: 'p-mon-read', code: 'monitoring:read', description: 'View monitoring data.', module: 'activity_monitoring' },
      { id: 'p-leave-read', code: 'leave:read', description: 'View leave', module: 'leave' },
      { id: 'p-roles-read', code: 'roles:read', description: 'View roles', module: 'roles' }
    ];
    return {
      id,
      name: 'x',
      description: null,
      isSystem: false,
      permissions: all.filter((p) => permissionIds.includes(p.id)),
      universalPermissions: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null
    };
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RoleFormModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(RoleFormModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('groupedCatalog', catalog);
    fixture.detectChanges();
  });

  describe('create', () => {
    it('renders each module as a shared data table with the module name as the column header', () => {
      expect(el().textContent).toContain('Create new role');
      const tables = el().querySelectorAll('app-data-table');
      expect(tables.length).toBe(2);
      expect(tables[0].querySelector('th:not(.data-table__select-cell)')?.textContent?.trim()).toBe('Activity Monitoring');
      expect(tables[0].querySelectorAll('tbody tr.data-table__row').length).toBe(2);
    });

    it('selects a whole module from the header checkbox', () => {
      const selectAll = el().querySelector<HTMLInputElement>('app-data-table th.data-table__select-cell input')!;
      selectAll.checked = true;
      selectAll.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect([...component.selectedIds()]).toEqual(['p-mon-read', 'p-mon-config']);
      expect(el().textContent).toContain('2 selected');
    });

    it('toggles a permission by clicking its row, and submits the selection', () => {
      el().querySelector<HTMLElement>('app-data-table tbody tr.data-table__row')!.click();
      fixture.detectChanges();
      expect(component.selectedIds().has('p-mon-read')).toBe(true);

      let submitted: RoleFormSubmitValue | undefined;
      component.save.subscribe((v) => (submitted = v));
      component.form.controls.name.setValue('Auditor');
      component.onSubmit();

      expect(submitted?.selectedPermissionIds).toEqual(['p-mon-read']);
    });

    it('without a name, does not submit and brings the name field (and its error) into view', () => {
      const nameInput = el().querySelector<HTMLInputElement>('app-input input')!;
      // jsdom has no scrollIntoView; stub it so the call can be observed.
      const scrolled = vi.fn();
      nameInput.scrollIntoView = scrolled;
      const focused = vi.spyOn(nameInput, 'focus');
      let submitted = false;
      component.save.subscribe(() => (submitted = true));

      component.onSubmit();
      fixture.detectChanges();

      expect(submitted).toBe(false);
      expect(scrolled).toHaveBeenCalled();
      expect(focused).toHaveBeenCalled();
      expect(el().textContent).toContain('Role name is required');
    });
  });

  describe('edit (custom role)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('role', summary('role-custom', false));
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
    });

    it('prefills the details and seeds the current permissions once they load', () => {
      expect(component.form.controls.name.value).toBe('Auditor');
      expect(component.selectedIds().size).toBe(0);

      fixture.componentRef.setInput('roleDetail', detail('role-custom', ['p-mon-read', 'p-leave-read']));
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();

      expect([...component.selectedIds()].sort()).toEqual(['p-leave-read', 'p-mon-read']);
      expect(el().textContent).toContain('Save changes');
    });

    it('ignores a detail that belongs to a different role', () => {
      fixture.componentRef.setInput('roleDetail', detail('role-other', ['p-mon-read']));
      fixture.detectChanges();

      expect(component.selectedIds().size).toBe(0);
    });

    it('does not submit while the current permissions are still loading', () => {
      let submitted = false;
      component.save.subscribe(() => (submitted = true));
      component.onSubmit();

      expect(submitted).toBe(false);
    });

    it('submits an empty list when every permission is removed', () => {
      fixture.componentRef.setInput('roleDetail', detail('role-custom', ['p-mon-read']));
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();
      component.setPermission('p-mon-read', false);

      let submitted: RoleFormSubmitValue | undefined;
      component.save.subscribe((v) => (submitted = v));
      component.onSubmit();

      expect(submitted?.selectedPermissionIds).toEqual([]);
    });
  });

  describe('view (system role)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('role', summary('role-gm', true, 3));
      fixture.componentRef.setInput('roleDetail', detail('role-gm', ['p-mon-read', 'p-leave-read', 'p-roles-read']));
      fixture.detectChanges();
    });

    it('is read-only: no form fields, every checkbox disabled, only a Close button', () => {
      expect(el().querySelector('app-input')).toBeNull();
      const boxes = Array.from(el().querySelectorAll<HTMLInputElement>('app-data-table input[type="checkbox"]'));
      expect(boxes.length).toBeGreaterThan(0);
      expect(boxes.every((b) => b.disabled)).toBe(true);
      expect(el().textContent).toContain('Close');
      expect(el().textContent).not.toContain('Save changes');
    });

    it('shows granted permissions outside the catalog as platform access, so ticks match the list count', () => {
      expect(component.platformPermissions().map((p) => p.code)).toEqual(['roles:read']);
      const checked = el().querySelectorAll('tbody input[type="checkbox"]:checked');
      expect(checked.length).toBe(3);
      expect(el().textContent).toContain('3 selected');
    });
  });

  describe('validation matches the backend role validators', () => {
    it('limits the name to 50 characters of letters, numbers, spaces, hyphens and underscores', () => {
      const name = component.form.controls.name;
      name.setValue('a'.repeat(51));
      expect(name.errors).toEqual({ maxlength: { requiredLength: 50, actualLength: 51 } });
      name.setValue('Ops & Finance');
      expect(name.errors).toEqual({ nameChars: true });
      name.setValue('Ops lead-2_b');
      expect(name.errors).toBeNull();
      name.setValue('   ');
      expect(name.errors).toEqual({ required: true });
    });

    it('limits the description to 255 characters', () => {
      component.form.controls.description.setValue('a'.repeat(256));
      expect(component.form.controls.description.errors).toEqual({ maxlength: { requiredLength: 255, actualLength: 256 } });
    });

    it('shows the shared message for the name', () => {
      component.form.controls.name.setValue('Ops & Finance');
      component.form.controls.name.markAsTouched();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Role name may only contain letters, numbers, spaces, hyphens and underscores.',
      );
    });
  });

  describe('server field errors (task 20 follow-up)', () => {
    const badRequest = (errors: Record<string, string[]>) =>
      toApiError(new HttpErrorResponse({ status: 400, error: { title: 'Validation Error', errors } }));

    it('shows the field message of a refused save under its field', () => {
      fixture.detectChanges();
      fixture.componentRef.setInput('serverError', badRequest({ Name: ['A role with this name already exists.'] }));
      fixture.detectChanges();
      expect(fixture.componentInstance.form.controls.name.errors?.['server']).toEqual({ message: 'A role with this name already exists.' });
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('A role with this name already exists.');
    });

    it('shows a message with no field inside the modal', () => {
      fixture.detectChanges();
      fixture.componentRef.setInput('serverError', badRequest({ LegalEntityId: ['Legal entity ID is required.'] }));
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Legal entity ID is required.');
    });
  });
});
