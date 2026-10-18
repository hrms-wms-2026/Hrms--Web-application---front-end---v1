import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoleListTableComponent } from './role-list-table.component';
import { RoleSummaryResponse } from '../../models/role.model';

describe('RoleListTableComponent', () => {
  let fixture: ComponentFixture<RoleListTableComponent>;
  let component: RoleListTableComponent;

  const role = (id: string, name: string, isSystem: boolean): RoleSummaryResponse => ({
    id,
    name,
    description: null,
    isSystem,
    permissionCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null,
    sourceTemplateId: null
  });
  const roles = [role('r-sys', 'Tenant Owner', true), role('r-custom', 'Auditor', false)];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const rowFor = (id: string): HTMLElement => el().querySelector<HTMLElement>(`tr[data-id="${id}"]`)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RoleListTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(RoleListTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roles', roles);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
  });

  it('opens the role popup when a row is clicked', () => {
    const opened: RoleSummaryResponse[] = [];
    component.openRole.subscribe((r) => opened.push(r));

    rowFor('r-sys').click();

    expect(opened.map((r) => r.id)).toEqual(['r-sys']);
  });

  it('shows icon actions instead of a 3-dot menu: view for system roles, edit + archive for custom roles', () => {
    const sysButtons = rowFor('r-sys').querySelectorAll('.rlt-action-btn');
    expect(Array.from(sysButtons).map((b) => b.getAttribute('title'))).toEqual(['View permissions']);

    const customButtons = rowFor('r-custom').querySelectorAll('.rlt-action-btn');
    expect(Array.from(customButtons).map((b) => b.getAttribute('title'))).toEqual(['Edit role', 'Archive']);
  });

  it('action icons fire once, without also triggering the row click', () => {
    const opened: string[] = [];
    const archived: string[] = [];
    component.openRole.subscribe((r) => opened.push(r.id));
    component.archiveRole.subscribe((r) => archived.push(r.id));

    rowFor('r-custom').querySelector<HTMLButtonElement>('[title="Edit role"]')!.click();
    rowFor('r-custom').querySelector<HTMLButtonElement>('[title="Archive"]')!.click();

    expect(opened).toEqual(['r-custom']);
    expect(archived).toEqual(['r-custom']);
  });

  it('hides the actions column without roles:manage, but rows still open the role popup', () => {
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();
    const opened: string[] = [];
    component.openRole.subscribe((r) => opened.push(r.id));

    expect(el().querySelector('.rlt-action-btn')).toBeNull();
    rowFor('r-custom').click();
    expect(opened).toEqual(['r-custom']);
  });
});
