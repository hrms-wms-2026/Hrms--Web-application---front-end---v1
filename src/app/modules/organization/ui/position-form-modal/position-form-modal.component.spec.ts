import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PositionFormModalComponent, generateShortCode } from './position-form-modal.component';
import { RoleSummaryResponse } from '../../models/role.model';
import { By } from '@angular/platform-browser';

describe('PositionFormModalComponent', () => {
  let component: PositionFormModalComponent;
  let fixture: ComponentFixture<PositionFormModalComponent>;

  const mockRoles: RoleSummaryResponse[] = [
    {
      id: 'role-1',
      name: 'HR Manager',
      description: 'Human Resources Manager Role',
      isSystem: false,
      permissionCount: 10,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
      sourceTemplateId: null
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PositionFormModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PositionFormModalComponent);
    component = fixture.componentInstance;
    component.companyName = 'Acme Corp';
    component.availableDepartments = [{ id: 'dept-1', name: 'Engineering' }];
    component.availablePositions = [{ id: 'pos-1', name: 'VP Engineering' }];
    component.availableRoles = mockRoles;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('Template Short Code Generator (generateShortCode)', () => {
    it('generates correct short codes (<= 5 chars) for standard executive and manager roles', () => {
      expect(generateShortCode('Chief Executive Officer')).toBe('CEO');
      expect(generateShortCode('CEO / Chief Executive Officer')).toBe('CCEO');
      expect(generateShortCode('Chief Operating Officer')).toBe('COO');
      expect(generateShortCode('COO / Chief Operating Officer')).toBe('CCOO');
      expect(generateShortCode('Chief Technology Officer')).toBe('CTO');
      expect(generateShortCode('CTO / Chief Technology Officer')).toBe('CCTO');
      expect(generateShortCode('Chief Financial Officer')).toBe('CFO');
      expect(generateShortCode('HR Manager')).toBe('HM');
      expect(generateShortCode('Software Engineer')).toBe('SE');
      expect(generateShortCode('Project Manager')).toBe('PM');
    });

    it('handles single word inputs and limits output to max 5 uppercase characters', () => {
      expect(generateShortCode('Engineering')).toBe('ENGIN');
      expect(generateShortCode('Operations')).toBe('OPERA');
      expect(generateShortCode('Lead')).toBe('LEAD');
      expect(generateShortCode('')).toBe('');
      expect(generateShortCode(null)).toBe('');
    });
  });

  it('does NOT render Position type dropdown', () => {
    component.position = null;
    fixture.detectChanges();

    const typeSelect = fixture.debugElement.query(By.css('app-select[label="Position type *"]'));
    expect(typeSelect).toBeFalsy();
    const typeSelectAlt = fixture.debugElement.query(By.css('app-select[label="Position type"]'));
    expect(typeSelectAlt).toBeFalsy();
  });

  it('renders Capacity input unconditionally with label "Capacity *", defaults to 1, and shows helper text', () => {
    component.position = null;
    fixture.detectChanges();

    const capacityInput = fixture.debugElement.query(By.css('app-input[label="Capacity *"]'));
    expect(capacityInput).toBeTruthy();
    expect(component.form.controls.maxOccupancy.value).toBe(1);

    const htmlContent = fixture.nativeElement.textContent;
    expect(htmlContent).toContain('Capacity 1 creates a single-seat position. More than 1 creates a pooled position.');
  });

  it('validates capacity input: requires positive integer >= 1 (rejects 0, negative, decimal)', () => {
    component.position = null;
    fixture.detectChanges();

    const maxOccControl = component.form.controls.maxOccupancy;

    // Default 1 is valid
    expect(maxOccControl.valid).toBe(true);

    // 0 is invalid
    maxOccControl.setValue(0);
    expect(maxOccControl.invalid).toBe(true);

    // Negative is invalid
    maxOccControl.setValue(-1);
    expect(maxOccControl.invalid).toBe(true);

    // Decimal is invalid
    maxOccControl.setValue(1.5);
    expect(maxOccControl.invalid).toBe(true);

    // Valid positive integer
    maxOccControl.setValue(5);
    expect(maxOccControl.valid).toBe(true);
  });

  it('validates position code: accepts max 5 chars, rejects >5 chars', () => {
    component.position = null;
    fixture.detectChanges();

    const codeControl = component.form.controls.code;

    // 5 chars valid
    codeControl.setValue('ABCDE');
    expect(codeControl.valid).toBe(true);

    // 6 chars invalid
    codeControl.setValue('ABCDEF');
    expect(codeControl.invalid).toBe(true);
  });

  it('renders system access section with role dropdown when creating position and user has roles:read permission', () => {
    component.position = null;
    component.hasRoleReadAccess = true;
    component.canConfigureAccess = true;
    fixture.detectChanges();

    const accessSection = fixture.debugElement.query(By.css('.pfm-access-section'));
    expect(accessSection).toBeTruthy();

    const roleSelect = fixture.debugElement.query(By.css('app-select[label="Default system role"]'));
    expect(roleSelect).toBeTruthy();
  });

  it('renders disabled notice and no role selector when user lacks roles:read permission', () => {
    component.position = null;
    component.hasRoleReadAccess = false;
    component.canConfigureAccess = false;
    fixture.detectChanges();

    const notice = fixture.debugElement.query(By.css('.pfm-access-notice'));
    expect(notice).toBeTruthy();
    expect(notice.nativeElement.textContent).toContain('You need role access to configure system access.');

    const roleSelect = fixture.debugElement.query(By.css('app-select[label="Default system role"]'));
    expect(roleSelect).toBeFalsy();
  });

  it('emits PositionFormSubmitValue without positionType', () => {
    component.position = null;
    component.hasRoleReadAccess = true;
    fixture.detectChanges();

    let emittedValue: any = null;
    component.save.subscribe((val) => {
      emittedValue = val;
    });

    component.form.patchValue({
      name: 'Software Engineer',
      code: 'SE101',
      departmentId: 'dept-1',
      maxOccupancy: 1,
      selectedAccessRoleId: 'role-1',
      accessRequiresApproval: true
    });

    component.onSubmit();

    expect(emittedValue).toEqual({
      departmentId: 'dept-1',
      name: 'Software Engineer',
      code: 'SE101',
      maxOccupancy: 1,
      reportsToPositionId: null,
      selectedAccessRoleId: 'role-1',
      accessRequiresApproval: true
    });
    expect(emittedValue.positionType).toBeUndefined();
  });

  it('prefills form fields from templatePreset with short code <= 5 chars', () => {
    component.position = null;
    component.templatePreset = {
      source: 'template-drop-under-position',
      positionName: 'Senior Software Engineer',
      positionKey: 'sr-sw-eng',
      departmentId: 'dept-1',
      reportsToPositionId: 'pos-1',
      reportsToPositionName: 'VP Engineering',
      suggestedDepartmentName: null,
      departmentMessage: 'Inherited department "Engineering" from \'VP Engineering\'.'
    };

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.form.value.name).toBe('Senior Software Engineer');
    expect(component.form.value.code).toBe('SSE');
    expect(component.form.value.code!.length).toBeLessThanOrEqual(5);
    expect(component.form.value.departmentId).toBe('dept-1');
    expect(component.form.value.reportsToPositionId).toBe('pos-1');

    const banner = fixture.nativeElement.querySelector('.pfm-template-banner');
    expect(banner).toBeNull();
  });

  it('renders missing-department helper near department field only when department cannot be matched', () => {
    component.position = null;
    component.templatePreset = {
      source: 'template-drop-root',
      positionName: 'Product Manager',
      positionKey: 'product-mgr',
      departmentId: null,
      reportsToPositionId: null,
      suggestedDepartmentName: 'Product Strategy'
    };

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.form.value.departmentId).toBe('');
    const helperNotice = fixture.nativeElement.querySelector('.pfm-dept-suggest-helper');
    expect(helperNotice).not.toBeNull();
    expect(helperNotice.textContent).toContain('Template suggests department: Product Strategy. Select an existing department before creating this position.');

    component.form.controls.departmentId.setValue('dept-1');
    fixture.detectChanges();

    const helperAfterSelection = fixture.nativeElement.querySelector('.pfm-dept-suggest-helper');
    expect(helperAfterSelection).toBeNull();
  });

  it('emits backend-safe payload without positionType when created from template preset', () => {
    component.position = null;
    component.templatePreset = {
      source: 'template-click',
      positionName: 'Senior Software Engineer',
      positionKey: 'sr-sw-eng',
      departmentId: 'dept-1',
      reportsToPositionId: 'pos-1',
      suggestedDepartmentName: null
    };

    component.ngOnInit();
    fixture.detectChanges();

    let emittedValue: any = null;
    component.save.subscribe((val) => {
      emittedValue = val;
    });

    component.onSubmit();

    expect(emittedValue).toEqual({
      departmentId: 'dept-1',
      name: 'Senior Software Engineer',
      code: 'SSE',
      maxOccupancy: 1,
      reportsToPositionId: 'pos-1',
      selectedAccessRoleId: null,
      accessRequiresApproval: false
    });
    expect(emittedValue.positionType).toBeUndefined();
  });
});
