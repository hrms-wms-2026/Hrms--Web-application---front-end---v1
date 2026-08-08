import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PositionCoverageModalComponent } from './position-coverage-modal.component';
import { ManagementCoverageRecordResponse, PositionListItemResponse } from '../../models/position.model';

describe('PositionCoverageModalComponent', () => {
  const ownerPosition: PositionListItemResponse = {
    id: 'owner-1',
    legalEntityId: 'le-1',
    departmentId: 'dept-1',
    name: 'Owner Manager',
    code: 'OWN-1',
    positionType: 'unique',
    maxOccupancy: 1,
    reportsToPositionId: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null
  };

  function makeRecord(overrides: Partial<ManagementCoverageRecordResponse>): ManagementCoverageRecordResponse {
    return {
      id: overrides.id ?? 'record-1',
      ownerPositionId: 'owner-1',
      ownerPositionName: 'Owner Manager',
      coveredTargetType: 'Position',
      coveredPositionId: 'target-1',
      coveredPositionName: 'Target Position',
      coveredDepartmentId: null,
      coveredDepartmentName: null,
      ownerOrder: 1,
      source: 'Manual',
      isLocked: false,
      status: 'active',
      ...overrides
    };
  }

  async function createComponent(
    coverageRecords: readonly ManagementCoverageRecordResponse[] = [],
    canManage = false
  ): Promise<{ component: PositionCoverageModalComponent; fixture: ReturnType<typeof TestBed.createComponent> }> {
    await TestBed.configureTestingModule({ imports: [PositionCoverageModalComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PositionCoverageModalComponent);
    fixture.componentRef.setInput('position', ownerPosition);
    fixture.componentRef.setInput('coverageRecords', coverageRecords);
    fixture.componentRef.setInput('availablePositions', [
      { id: 'owner-1', name: 'Owner Manager' },
      { id: 'target-1', name: 'Target Position' }
    ]);
    fixture.componentRef.setInput('availableDepartments', [{ id: 'dept-1', name: 'Support' }]);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture };
  }

  it('formats ownerOrder 1 as Primary Manager and N>1 as Backup Manager N-1', async () => {
    const { component } = await createComponent();
    expect(component.formatResponsibilityLabel(1)).toBe('Primary Manager');
    expect(component.formatResponsibilityLabel(2)).toBe('Backup Manager 1');
    expect(component.formatResponsibilityLabel(5)).toBe('Backup Manager 4');
  });

  it('offers only order 1 when no target is selected yet', async () => {
    const { component } = await createComponent();
    expect(component.ownerOrderOptions).toEqual([{ value: '1', label: 'Primary Manager' }]);
  });

  it('does not offer an already-used order for the selected covered target', async () => {
    const { component } = await createComponent([makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1' })]);
    component.onCoveredPositionChange('target-1');

    const values = component.ownerOrderOptions.map((o) => o.value);
    expect(values).not.toContain('1');
    expect(values).toContain('2');
  });

  it('offers the next available order beyond the historical Primary/Backup1/Backup2 trio', async () => {
    const { component } = await createComponent([
      makeRecord({ id: 'r1', ownerOrder: 1, coveredPositionId: 'target-1' }),
      makeRecord({ id: 'r2', ownerOrder: 2, coveredPositionId: 'target-1' }),
      makeRecord({ id: 'r3', ownerOrder: 3, coveredPositionId: 'target-1' })
    ]);
    component.onCoveredPositionChange('target-1');

    expect(component.ownerOrderOptions).toEqual([{ value: '4', label: 'Backup Manager 3' }]);
  });

  it('does not let used orders for one covered target leak into a different target', async () => {
    const { component } = await createComponent([makeRecord({ ownerOrder: 1, coveredPositionId: 'other-target' })]);
    component.onCoveredPositionChange('target-1');

    expect(component.ownerOrderOptions).toEqual([{ value: '1', label: 'Primary Manager' }]);
  });

  it('ignores inactive coverage records when computing used orders', async () => {
    const { component } = await createComponent([
      makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1', status: 'inactive' })
    ]);
    component.onCoveredPositionChange('target-1');

    expect(component.ownerOrderOptions).toEqual([{ value: '1', label: 'Primary Manager' }]);
  });

  it('resets the selected order when it is no longer offered after switching target', async () => {
    const { component } = await createComponent([makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1' })]);
    component.addForm.controls.ownerOrder.setValue(1);

    component.onCoveredPositionChange('target-1');

    expect(component.addForm.controls.ownerOrder.value).toBe(2);
  });

  it('excludes the current owner position from the covered-position options', async () => {
    const { component } = await createComponent();
    const values = component.positionOptions.map((o) => o.value);
    expect(values).not.toContain('owner-1');
    expect(values).toContain('target-1');
  });

  it('renders locked records under the automatic section and unlocked ones under manual', async () => {
    const automatic = makeRecord({ id: 'auto-1', isLocked: true, source: 'ReportingStructure' });
    const manual = makeRecord({ id: 'manual-1', isLocked: false, source: 'Manual' });
    const { fixture } = await createComponent([automatic, manual], true);

    const automaticBadges = fixture.debugElement.queryAll(By.css('.pcm-badge--automatic'));
    const manualBadges = fixture.debugElement.queryAll(By.css('.pcm-badge--manual'));
    expect(automaticBadges.length).toBe(1);
    expect(manualBadges.length).toBe(1);
  });

  it('does not show edit or remove actions on locked/automatic records', async () => {
    const automatic = makeRecord({ id: 'auto-1', isLocked: true, source: 'ReportingStructure' });
    const { fixture } = await createComponent([automatic], true);

    expect(fixture.debugElement.queryAll(By.css('.pcm-text-btn')).length).toBe(0);
    expect(fixture.debugElement.queryAll(By.css('.pcm-delete-btn')).length).toBe(0);
  });

  it('shows edit and remove actions on manual records when canManage is true', async () => {
    const manual = makeRecord({ id: 'manual-1', isLocked: false, source: 'Manual' });
    const { fixture } = await createComponent([manual], true);

    expect(fixture.debugElement.queryAll(By.css('.pcm-text-btn')).length).toBe(1);
    expect(fixture.debugElement.queryAll(By.css('.pcm-delete-btn')).length).toBe(1);
  });

  it('keeps the add form collapsed by default', async () => {
    const { component, fixture } = await createComponent([], true);
    expect(component.showAddForm.value).toBe(false);
    expect(fixture.debugElement.query(By.css('.pcm-add-form'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.pcm-toggle-add-btn'))).not.toBeNull();
  });

  it('opens the add form when "Add manual coverage" is clicked', async () => {
    const { component, fixture } = await createComponent([], true);

    fixture.debugElement.query(By.css('.pcm-toggle-add-btn')).nativeElement.click();
    fixture.detectChanges();

    expect(component.showAddForm.value).toBe(true);
    expect(fixture.debugElement.query(By.css('.pcm-add-form'))).not.toBeNull();
  });

  it('computes edit-level options that include the record\'s own current ownerOrder', async () => {
    const record = makeRecord({ id: 'manual-1', ownerOrder: 2, coveredPositionId: 'target-1' });
    const other = makeRecord({ id: 'manual-2', ownerOrder: 1, coveredPositionId: 'target-1' });
    const { component } = await createComponent([record, other]);

    const values = component.editOwnerOrderOptions(record).map((o) => o.value);
    expect(values).toContain('2');
    expect(values).not.toContain('1');
    expect(values).toContain('3');
  });

  it('emits updateCoverage with the selected ownerOrder when saving an edit', async () => {
    const record = makeRecord({ id: 'manual-1', ownerOrder: 1 });
    const { component } = await createComponent([record], true);

    const emitted: unknown[] = [];
    component.updateCoverage.subscribe((event) => emitted.push(event));

    component.startEdit(record);
    component.onEditOwnerOrderChange('3');
    component.saveEdit(record);

    expect(emitted).toEqual([{ coverageId: 'manual-1', payload: { ownerOrder: 3 } }]);
    expect(component.editingCoverageId()).toBeNull();
  });

  it('treats a self-coverage manual record as read-only with a warning, not editable/removable', async () => {
    const selfRecord = makeRecord({
      id: 'self-1',
      isLocked: false,
      source: 'Manual',
      coveredTargetType: 'Position',
      coveredPositionId: 'owner-1'
    });
    const { component, fixture } = await createComponent([selfRecord], true);

    expect(component.isSelfCoverage(selfRecord)).toBe(true);
    expect(fixture.debugElement.query(By.css('.pcm-self-warning'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.pcm-text-btn'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.pcm-delete-btn'))).toBeNull();
  });

  it('displays the error message from the error input (e.g. a 409 conflict)', async () => {
    await TestBed.configureTestingModule({ imports: [PositionCoverageModalComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PositionCoverageModalComponent);
    fixture.componentRef.setInput('position', ownerPosition);
    fixture.componentRef.setInput('coverageRecords', []);
    fixture.componentRef.setInput('availablePositions', []);
    fixture.componentRef.setInput('availableDepartments', []);
    fixture.componentRef.setInput(
      'error',
      'An active coverage record already exists for this covered target at this responsibility level.'
    );
    fixture.detectChanges();

    const alert = fixture.debugElement.query(By.css('.pcm-error-alert'));
    expect(alert.nativeElement.textContent).toContain('An active coverage record already exists');
  });

  it('onDelete emits removeCoverage for unlocked manual records', async () => {
    const record = makeRecord({ id: 'manual-1', isLocked: false });
    const { component } = await createComponent([record]);

    const emitted: string[] = [];
    component.removeCoverage.subscribe((id) => emitted.push(id));

    component.onDelete(record);

    expect(emitted).toEqual(['manual-1']);
  });
});
