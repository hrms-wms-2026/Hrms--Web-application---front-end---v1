import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PositionCoverageModalComponent } from './position-coverage-modal.component';
import { AddCoverageRecordRequest, ManagementCoverageRecordResponse, PositionListItemResponse } from '../../models/position.model';

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
    canManage = false,
    // targetOccupancy is the parent-fetched, all-owners view of coverage for whichever target is
    // selected/edited - it's what actually drives occupied-level disabling now (see the
    // "sees coverage owned by a DIFFERENT position" regression test below). Defaulting it to equal
    // coverageRecords keeps every existing single-owner test scenario's semantics unchanged.
    targetOccupancy: readonly ManagementCoverageRecordResponse[] = coverageRecords
  ): Promise<{ component: PositionCoverageModalComponent; fixture: ReturnType<typeof TestBed.createComponent> }> {
    await TestBed.configureTestingModule({ imports: [PositionCoverageModalComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PositionCoverageModalComponent);
    fixture.componentRef.setInput('position', ownerPosition);
    fixture.componentRef.setInput('coverageRecords', coverageRecords);
    fixture.componentRef.setInput('targetOccupancy', targetOccupancy);
    fixture.componentRef.setInput('availablePositions', [
      { id: 'owner-1', name: 'Owner Manager' },
      { id: 'target-1', name: 'Target Position' },
      { id: 'target-2', name: 'Other Target' }
    ]);
    fixture.componentRef.setInput('availableDepartments', [{ id: 'dept-1', name: 'Support' }]);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture };
  }

  it('formats ownerOrder 1 as Primary Manager and N>1 as Backup Manager N-1, with occupied suffix when occupied', async () => {
    const { component } = await createComponent();
    expect(component.formatResponsibilityLabel(1)).toBe('Primary Manager');
    expect(component.formatResponsibilityLabel(1, true)).toBe('Primary Manager — already assigned');
    expect(component.formatResponsibilityLabel(2)).toBe('Backup Manager 1');
    expect(component.formatResponsibilityLabel(2, true)).toBe('Backup Manager 1 — already assigned');
    expect(component.formatResponsibilityLabel(5)).toBe('Backup Manager 4');
  });

  it('offers Primary Manager and Backup 1..3 by default when no target is selected yet', async () => {
    const { component } = await createComponent();
    expect(component.ownerOrderOptions).toEqual([
      { value: '1', label: 'Primary Manager', disabled: false },
      { value: '2', label: 'Backup Manager 1', disabled: false },
      { value: '3', label: 'Backup Manager 2', disabled: false },
      { value: '4', label: 'Backup Manager 3', disabled: false }
    ]);
  });

  it('disables Primary Manager option and labels it clearly when selected target has an automatic Primary Manager', async () => {
    const autoPrimary = makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1', isLocked: true, source: 'ReportingStructure' });
    const { component } = await createComponent([autoPrimary]);
    component.onCoveredPositionChange('target-1');

    const primaryOpt = component.ownerOrderOptions.find((o) => o.value === '1');
    expect(primaryOpt).toEqual({ value: '1', label: 'Primary Manager — already assigned', disabled: true });

    const backup1Opt = component.ownerOrderOptions.find((o) => o.value === '2');
    expect(backup1Opt).toEqual({ value: '2', label: 'Backup Manager 1', disabled: false });
  });

  it('auto-selects Backup Manager 1 when Primary Manager is occupied upon target selection', async () => {
    const autoPrimary = makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1', isLocked: true });
    const { component } = await createComponent([autoPrimary]);

    component.addForm.controls.ownerOrder.setValue(1);
    component.onCoveredPositionChange('target-1');

    expect(component.addForm.controls.ownerOrder.value).toBe(2);
  });

  it('auto-selects Backup Manager 2 when Primary Manager and Backup Manager 1 are occupied', async () => {
    const autoPrimary = makeRecord({ id: 'r1', ownerOrder: 1, coveredPositionId: 'target-1' });
    const manualBackup1 = makeRecord({ id: 'r2', ownerOrder: 2, coveredPositionId: 'target-1' });
    const { component } = await createComponent([autoPrimary, manualBackup1]);

    component.addForm.controls.ownerOrder.setValue(1);
    component.onCoveredPositionChange('target-1');

    expect(component.addForm.controls.ownerOrder.value).toBe(3);
  });

  it('disables Backup 1 option when selected target has manual Backup 1', async () => {
    const manualBackup1 = makeRecord({ ownerOrder: 2, coveredPositionId: 'target-1', isLocked: false, source: 'Manual' });
    const { component } = await createComponent([manualBackup1]);
    component.onCoveredPositionChange('target-1');

    const backup1Opt = component.ownerOrderOptions.find((o) => o.value === '2');
    expect(backup1Opt).toEqual({ value: '2', label: 'Backup Manager 1 — already assigned', disabled: true });

    const primaryOpt = component.ownerOrderOptions.find((o) => o.value === '1');
    expect(primaryOpt?.disabled).toBe(false);

    const backup2Opt = component.ownerOrderOptions.find((o) => o.value === '3');
    expect(backup2Opt?.disabled).toBe(false);
  });

  it('remains Backup 2 enabled when only Backup 1 exists for the selected target', async () => {
    const manualBackup1 = makeRecord({ ownerOrder: 2, coveredPositionId: 'target-1' });
    const { component } = await createComponent([manualBackup1]);
    component.onCoveredPositionChange('target-1');

    const backup2Opt = component.ownerOrderOptions.find((o) => o.value === '3');
    expect(backup2Opt?.disabled).toBe(false);
  });

  it('includes Backup Manager 5 — already assigned as disabled and Backup Manager 6 as enabled when usedOrders contains order 6', async () => {
    const backup5 = makeRecord({ ownerOrder: 6, coveredPositionId: 'target-1' });
    const { component } = await createComponent([backup5]);
    component.onCoveredPositionChange('target-1');

    const order6Opt = component.ownerOrderOptions.find((o) => o.value === '6');
    expect(order6Opt).toEqual({ value: '6', label: 'Backup Manager 5 — already assigned', disabled: true });

    const order7Opt = component.ownerOrderOptions.find((o) => o.value === '7');
    expect(order7Opt).toEqual({ value: '7', label: 'Backup Manager 6', disabled: false });
  });

  it('ensures disabling is target-specific and does not disable options for a different target', async () => {
    const target1Primary = makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1' });
    const { component } = await createComponent([target1Primary]);

    component.onCoveredPositionChange('target-2');

    const primaryOpt = component.ownerOrderOptions.find((o) => o.value === '1');
    expect(primaryOpt?.disabled).toBe(false);
  });

  it('ignores inactive coverage records when computing disabled orders', async () => {
    const { component } = await createComponent([
      makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1', status: 'inactive' })
    ]);
    component.onCoveredPositionChange('target-1');

    const primaryOpt = component.ownerOrderOptions.find((o) => o.value === '1');
    expect(primaryOpt?.disabled).toBe(false);
  });

  it('ensures selected owner order never remains occupied after target change', async () => {
    const target1Primary = makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1' });
    const { component } = await createComponent([target1Primary]);
    component.addForm.controls.ownerOrder.setValue(1);

    component.onCoveredPositionChange('target-1');

    expect(component.addForm.controls.ownerOrder.value).toBe(2);
    const selectedOpt = component.ownerOrderOptions.find((o) => o.value === String(component.addForm.controls.ownerOrder.value));
    expect(selectedOpt?.disabled).toBe(false);
  });

  it('blocks client-side submission if an occupied level is submitted', async () => {
    const target1Primary = makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1' });
    const { component } = await createComponent([target1Primary], true);

    const emitted: AddCoverageRecordRequest[] = [];
    component.addCoverage.subscribe((req) => emitted.push(req));

    component.addForm.controls.coveredTargetType.setValue('Position');
    component.addForm.controls.coveredPositionId.setValue('target-1');
    component.addForm.controls.ownerOrder.setValue(1); // occupied!

    component.onAddSubmit();

    expect(emitted.length).toBe(0);
  });

  it('displays friendly helper text hints for occupied levels of the selected target', async () => {
    const autoPrimary = makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1', isLocked: true });
    const manualBackup1 = makeRecord({ ownerOrder: 2, coveredPositionId: 'target-1', isLocked: false });
    const { component } = await createComponent([autoPrimary, manualBackup1], true);

    component.onCoveredPositionChange('target-1');

    expect(component.occupiedLevelHints).toEqual([
      'Primary Manager is already assigned.',
      'Backup Manager 1 is already assigned.'
    ]);
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

  it('opens the add form when "Add manual coverage" is clicked and auto-selects first available', async () => {
    const autoPrimary = makeRecord({ ownerOrder: 1, coveredPositionId: 'target-1', isLocked: true });
    const { component, fixture } = await createComponent([autoPrimary], true);

    component.addForm.controls.coveredPositionId.setValue('target-1');
    component.addForm.controls.ownerOrder.setValue(1);

    fixture.debugElement.query(By.css('.pcm-toggle-add-btn')).nativeElement.click();
    fixture.detectChanges();

    expect(component.showAddForm.value).toBe(true);
    expect(component.addForm.controls.ownerOrder.value).toBe(2);
    expect(fixture.debugElement.query(By.css('.pcm-add-form'))).not.toBeNull();
  });

  it('computes edit-level options that keep the record\'s own current ownerOrder enabled and unlabeled with already assigned', async () => {
    const record = makeRecord({ id: 'manual-1', ownerOrder: 2, coveredPositionId: 'target-1' });
    const other = makeRecord({ id: 'manual-2', ownerOrder: 1, coveredPositionId: 'target-1' });
    const { component } = await createComponent([record, other]);

    const opts = component.editOwnerOrderOptions(record);
    const ownOpt = opts.find((o) => o.value === '2');
    const otherOpt = opts.find((o) => o.value === '1');

    expect(ownOpt).toEqual({ value: '2', label: 'Backup Manager 1', disabled: false });
    expect(otherOpt).toEqual({ value: '1', label: 'Primary Manager — already assigned', disabled: true });
  });

  it('emits updateCoverage with the selected ownerOrder, and closes the edit row once saving succeeds', async () => {
    const record = makeRecord({ id: 'manual-1', ownerOrder: 1 });
    const { component, fixture } = await createComponent([record], true);

    const emitted: unknown[] = [];
    component.updateCoverage.subscribe((event) => emitted.push(event));

    component.startEdit(record);
    component.onEditOwnerOrderChange('3');
    component.saveEdit(record);

    expect(emitted).toEqual([{ coverageId: 'manual-1', payload: { ownerOrder: 3 } }]);
    // Not closed yet - saveEdit only emits; the parent's save is still in flight.
    expect(component.editingCoverageId()).toBe('manual-1');

    // Parent's store sets saving true then false (success: no error) around the async call.
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(component.editingCoverageId()).toBeNull();
  });

  it('leaves the edit row open (selection intact) when saving fails, instead of closing and discarding it', async () => {
    const record = makeRecord({ id: 'manual-1', ownerOrder: 1 });
    const { component, fixture } = await createComponent([record], true);

    component.startEdit(record);
    component.onEditOwnerOrderChange('3');
    component.saveEdit(record);

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('error', 'This target already has a Backup Manager 2.');
    fixture.detectChanges();

    expect(component.editingCoverageId()).toBe('manual-1');
    expect(component.editOwnerOrderValue()).toBe(3);
  });

  it('regression: does NOT wipe the add form and its target selection when the add submit fails (was: closed+reset unconditionally, leaving a stale error banner disconnected from a blank form)', async () => {
    const { component, fixture } = await createComponent([], true, []);

    component.toggleAddForm();
    component.onTargetTypeChange('Department');
    component.onCoveredDepartmentChange('dept-1');
    component.onAddSubmit();

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('error', 'This target already has a Primary Manager.');
    fixture.detectChanges();

    expect(component.showAddForm.value).toBe(true);
    expect(component.addForm.controls.coveredDepartmentId.value).toBe('dept-1');
  });

  it('closes and resets the add form once a successful submit is confirmed via the saving transition', async () => {
    const { component, fixture } = await createComponent([], true, []);

    component.toggleAddForm();
    component.onTargetTypeChange('Department');
    component.onCoveredDepartmentChange('dept-1');
    component.onAddSubmit();

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(component.showAddForm.value).toBe(false);
    expect(component.addForm.controls.coveredDepartmentId.value).toBe('');
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
      'Primary Manager is already assigned.'
    );
    fixture.detectChanges();

    const alert = fixture.debugElement.query(By.css('.pcm-error-alert'));
    expect(alert.nativeElement.textContent).toContain('Primary Manager is already assigned.');
  });

  it('onDelete emits removeCoverage for unlocked manual records', async () => {
    const record = makeRecord({ id: 'manual-1', isLocked: false });
    const { component } = await createComponent([record]);

    const emitted: string[] = [];
    component.removeCoverage.subscribe((id) => emitted.push(id));

    component.onDelete(record);

    expect(emitted).toEqual(['manual-1']);
  });

  describe('cross-owner occupancy (targetOccupancy)', () => {
    // Regression: a second position's coverage modal let the user pick "Primary Manager" for a
    // department another position already covers as Primary, because occupancy was computed from
    // coverageRecords (this owner's own rules only). It must be computed from targetOccupancy
    // (fetched by the parent for the selected target, across ALL owners) instead.
    it('disables Primary Manager when it is already assigned to a DIFFERENT owner position for the covered department', async () => {
      const otherOwnersPrimary = makeRecord({
        id: 'other-owner-record',
        ownerPositionId: 'some-other-position', // not this modal's owner ('owner-1')
        ownerPositionName: 'HR Manager-I',
        coveredTargetType: 'Department',
        coveredPositionId: null,
        coveredDepartmentId: 'dept-1',
        ownerOrder: 1
      });
      // coverageRecords (this owner's own rules) is empty - matches production reality where the
      // modal's own listCoverage() call would never include another owner's row.
      const { component } = await createComponent([], true, [otherOwnersPrimary]);

      component.onTargetTypeChange('Department');
      component.onCoveredDepartmentChange('dept-1');

      const primaryOpt = component.ownerOrderOptions.find((o) => o.value === '1');
      expect(primaryOpt).toEqual({ value: '1', label: 'Primary Manager — already assigned', disabled: true });
    });

    it('emits targetOccupancyRequested with the covered department when a department target is selected', async () => {
      const { component } = await createComponent([], true, []);
      const emitted: unknown[] = [];
      component.targetOccupancyRequested.subscribe((req) => emitted.push(req));

      component.onTargetTypeChange('Department');
      component.onCoveredDepartmentChange('dept-1');

      expect(emitted).toEqual([
        { coveredTargetType: 'Department', coveredPositionId: null, coveredDepartmentId: 'dept-1' }
      ]);
    });

    it('emits targetOccupancyRequested with excludingRecordId when starting an edit', async () => {
      const record = makeRecord({ id: 'manual-1', ownerOrder: 2, coveredTargetType: 'Department', coveredPositionId: null, coveredDepartmentId: 'dept-1' });
      const { component } = await createComponent([record], true, [record]);
      const emitted: unknown[] = [];
      component.targetOccupancyRequested.subscribe((req) => emitted.push(req));

      component.startEdit(record);

      expect(emitted).toEqual([
        { coveredTargetType: 'Department', coveredPositionId: null, coveredDepartmentId: 'dept-1', excludingRecordId: 'manual-1' }
      ]);
    });
  });

  describe('"+ Add another level" (no hardcoded backup-level ceiling)', () => {
    it('offers only Primary + 3 backups by default, with no way to reach Backup Manager 4', async () => {
      const { component } = await createComponent([], true, []);
      component.onTargetTypeChange('Department');
      component.onCoveredDepartmentChange('dept-1');

      expect(component.ownerOrderOptions.map((o) => o.value)).toEqual(['1', '2', '3', '4']);
    });

    it('adds one more level each time addAnotherLevel is called, with no ceiling', async () => {
      const { component } = await createComponent([], true, []);
      component.onTargetTypeChange('Department');
      component.onCoveredDepartmentChange('dept-1');

      component.addAnotherLevel();
      expect(component.ownerOrderOptions.map((o) => o.value)).toEqual(['1', '2', '3', '4', '5']);

      component.addAnotherLevel();
      component.addAnotherLevel();
      expect(component.ownerOrderOptions.map((o) => o.value)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    });

    it('resets the extra-levels count when the selected target changes', async () => {
      const { component } = await createComponent([], true, []);
      component.onTargetTypeChange('Department');
      component.onCoveredDepartmentChange('dept-1');
      component.addAnotherLevel();
      expect(component.ownerOrderOptions.length).toBe(5);

      component.onCoveredPositionChange('target-1');

      expect(component.ownerOrderOptions.length).toBe(4);
    });
  });
});
