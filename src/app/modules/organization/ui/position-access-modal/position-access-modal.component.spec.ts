import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PositionAccessModalComponent } from './position-access-modal.component';
import { PositionListItemResponse, PositionAccessTemplateResponse } from '../../models/position.model';
import { RoleSummaryResponse } from '../../models/role.model';
import { By } from '@angular/platform-browser';

describe('PositionAccessModalComponent', () => {
  let component: PositionAccessModalComponent;
  let fixture: ComponentFixture<PositionAccessModalComponent>;

  const mockPosition: PositionListItemResponse = {
    id: 'pos-1',
    legalEntityId: 'le-1',
    departmentId: 'dept-1',
    name: 'Dev Lead',
    code: 'DEV-1',
    positionType: 'unique',
    maxOccupancy: 1,
    reportsToPositionId: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null
  };

  const mockTemplate: PositionAccessTemplateResponse = {
    positionId: 'pos-1',
    roleId: 'role-1',
    roleName: 'Tech Lead',
    requiresApproval: true,
    isActive: true
  };

  const mockRoles: RoleSummaryResponse[] = [
    {
      id: 'role-1',
      name: 'Tech Lead',
      description: null,
      isSystem: false,
      permissionCount: 5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
      sourceTemplateId: null
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PositionAccessModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PositionAccessModalComponent);
    component = fixture.componentInstance;
    component.position = mockPosition;
    component.accessTemplate = mockTemplate;
    component.availableRoles = mockRoles;
    component.canManage = true;
    component.hasRoleReadAccess = true;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders current access template details', () => {
    const roleBadge = fixture.debugElement.query(By.css('.pam-role-badge'));
    expect(roleBadge).toBeTruthy();
    expect(roleBadge.nativeElement.textContent).toContain('Tech Lead');
  });

  it('emits saveAccess payload when form is submitted', () => {
    let emittedPayload: any = null;
    component.saveAccess.subscribe((payload) => {
      emittedPayload = payload;
    });

    component.form.patchValue({
      roleId: 'role-1',
      requiresApproval: false
    });

    component.onSubmit();

    expect(emittedPayload).toEqual({
      roleId: 'role-1',
      requiresApproval: false
    });
  });
});
