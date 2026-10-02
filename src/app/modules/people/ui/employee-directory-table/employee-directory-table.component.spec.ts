import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPLOYEE_COLUMNS, EmployeeColumnDef } from '../../models/employee-columns';
import { EmployeeListItemResponse } from '../../models/employee.model';
import { MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { EmployeeDirectoryTableComponent } from './employee-directory-table.component';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';

const emp = (id: string, overrides: Partial<EmployeeListItemResponse> = {}): EmployeeListItemResponse => ({
  id, employeeNumber: `N-${id}`, fullName: `Person ${id}`, email: `${id}@x.com`, departmentId: null, departmentName: 'Dept',
  positionId: null, positionName: 'Pos', legalEntityId: 'le', legalEntityName: 'Co', employmentTypeLabel: 'Full-time',
  status: 'active', reportingManagerId: null, reportingManagerName: 'Boss', ...overrides
});

@Component({
  standalone: true,
  imports: [EmployeeDirectoryTableComponent],
  template: `
    <app-employee-directory-table
      [employees]="employees()" [columns]="columns()" [sortBy]="'department'" [sortDir]="'asc'"
      [selectedIds]="selected()" [rowMenuItems]="menu"
      (sortChanged)="sorts.push($event)" (selectionChanged)="toggles.push($event)"
      (selectAllChanged)="selectAlls.push($event)" (rowAction)="actions.push($event)" />
  `
})
class HostComponent {
  employees = signal<readonly EmployeeListItemResponse[]>([emp('a'), emp('b', { reportingManagerName: null })]);
  columns = signal<readonly EmployeeColumnDef[]>(EMPLOYEE_COLUMNS.filter((c) => ['employee', 'department', 'reportingManager', 'email'].includes(c.key)));
  selected = signal<ReadonlySet<string>>(new Set());
  menu = (e: EmployeeListItemResponse): MenuItem[] => (e.id === 'a' ? [{ id: 'promote', label: 'Promote' }] : []);
  sorts: unknown[] = []; toggles: unknown[] = []; selectAlls: unknown[] = []; actions: { employee: EmployeeListItemResponse; actionId: string }[] = [];
}

async function setup() {
  const cached = new Map<string, { id: string; name: string; initials: string; avatarUrl: string | null }>();
  const directory = {
    get: vi.fn((id: string) => cached.get(id)),
    seed: vi.fn((identities: readonly { id: string; name: string; avatarFileId: string | null }[]) => {
      identities.forEach((identity) => cached.set(identity.id, {
        id: identity.id,
        name: identity.name,
        initials: identity.name.slice(0, 2).toUpperCase(),
        avatarUrl: identity.avatarFileId ? `https://api.test/files/${identity.avatarFileId}` : null
      }));
    }),
    ensureLoaded: vi.fn(async (ids: readonly string[]) => {
      ids.forEach((id) => cached.set(id, { id, name: 'Boss', initials: 'BO', avatarUrl: `https://api.test/identity/${id}` }));
    })
  };
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: EmployeeDirectoryStore, useValue: directory }
    ]
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  return { fixture, el, q, host: fixture.componentInstance, directory, router: TestBed.inject(Router) as unknown as { navigate: ReturnType<typeof vi.fn> } };
}

describe('EmployeeDirectoryTableComponent', () => {
  it('renders only the given columns, in order, plus select and menu columns', async () => {
    const { el } = await setup();
    const headers = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent!.trim()).filter(Boolean);
    expect(headers).toEqual(['Employee', 'Department', 'Reporting Manager', 'Email']);
  });

  it('shows an em dash for empty values', async () => {
    const { q } = await setup();
    expect(q('employee-row-b')!.textContent).toContain('—');
  });

  it('marks the active sort column and emits toggled direction on the same column, asc on a new one', async () => {
    const { q, host } = await setup();
    expect(q('employee-sort-department')!.getAttribute('aria-sort')).toBe('ascending');
    q('employee-sort-department')!.click();
    q('employee-sort-employee')!.click();
    expect(host.sorts).toEqual([{ sortBy: 'department', sortDir: 'desc' }, { sortBy: 'name', sortDir: 'asc' }]);
  });

  it('email column is not sortable', async () => {
    const { q } = await setup();
    expect(q('employee-sort-email')).toBeNull();
  });

  it('row click navigates to the detail page; checkbox and menu clicks do not', async () => {
    const { fixture, q, router } = await setup();
    q('employee-row-a')!.click();
    expect(router.navigate).toHaveBeenCalledWith(['/people/employees', 'a']);
    router.navigate.mockClear();
    (q('employee-select-a') as HTMLInputElement).click();
    q('employee-row-menu-a')!.querySelector('button')!.click();
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('Enter on the row opens the employee, but Enter bubbling from the row menu or checkbox does not', async () => {
    const { q, router } = await setup();
    const trigger = q('employee-row-menu-a')!.querySelector('button')!;
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    q('employee-select-a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(router.navigate).not.toHaveBeenCalled();
    q('employee-row-a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(router.navigate).toHaveBeenCalledWith(['/people/employees', 'a']);
  });

  it('emits selection and select-all over the visible rows; header reflects partial selection', async () => {
    const { fixture, q, host } = await setup();
    (q('employee-select-a') as HTMLInputElement).click();
    expect(host.toggles).toEqual([{ id: 'a', selected: true }]);
    host.selected.set(new Set(['a']));
    fixture.detectChanges();
    const all = q('employee-select-all') as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    all.click();
    expect(host.selectAlls).toEqual([{ ids: ['a', 'b'], selected: true }]);
    expect(q('employee-row-a')!.classList).toContain('edt__row--selected');
  });

  it('renders a row menu only when the row has items, and emits the chosen action', async () => {
    const { fixture, el, q, host } = await setup();
    expect(q('employee-row-menu-b')!.querySelector('button')).toBeNull();
    q('employee-row-menu-a')!.querySelector('button')!.click();
    fixture.detectChanges();
    (el.querySelector('[data-testid="menu-item-promote"]') as HTMLElement).click();
    expect(host.actions.map((a) => [a.employee.id, a.actionId])).toEqual([['a', 'promote']]);
  });

  it('shows the empty state when there are no employees', async () => {
    const { fixture, el, host } = await setup();
    host.employees.set([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No employees found');
  });

  it('renders a red warning ring and friendly tooltip for an employee who has not clocked in', async () => {
    const { fixture, el, host } = await setup();
    host.employees.set([
      emp('warn', {
        attendanceSummary: {
          showNotClockedInWarning: true,
          shouldHaveClockedIn: true,
          hasClockedInToday: false,
          workDate: '2026-09-28',
          timezone: 'Asia/Colombo',
          scheduledStartTime: '09:00',
          warningLabel: 'Still has not clocked in'
        }
      })
    ]);
    fixture.detectChanges();

    const warningAvatar = el.querySelector('.emp-avatar-wrapper--warning') as HTMLElement;
    expect(warningAvatar).not.toBeNull();
    expect(warningAvatar.getAttribute('aria-label')).toBe('Still has not clocked in');
    expect(warningAvatar.getAttribute('role')).toBe('img');
    expect(warningAvatar.getAttribute('tabindex')).toBe('0');
    expect(el.querySelector('.emp-attendance-warning-tooltip')?.textContent).toContain('Still has not clocked in');
  });

  it('does not render warning ring or tooltip when employee is not in warning state', async () => {
    const { el } = await setup();
    expect(el.querySelector('.emp-avatar-wrapper--warning')).toBeNull();
    expect(el.querySelector('.emp-attendance-warning-tooltip')).toBeNull();
  });

  it('renders cached employee and reporting-manager photos instead of fake avatars', async () => {
    const { fixture, host, q, directory } = await setup();
    host.employees.set([
      emp('photo', {
        avatarFileId: 'employee-avatar',
        reportingManagerId: 'manager-1',
        reportingManagerName: 'Manager One'
      })
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const images = q('employee-row-photo')!.querySelectorAll('app-avatar img');
    expect(images).toHaveLength(2);
    expect((images[0] as HTMLImageElement).src).toBe('https://api.test/files/employee-avatar');
    expect((images[1] as HTMLImageElement).src).toBe('https://api.test/identity/manager-1');
    expect(directory.ensureLoaded).toHaveBeenCalledWith(['manager-1']);
  });
});
