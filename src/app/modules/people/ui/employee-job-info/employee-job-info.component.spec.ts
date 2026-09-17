import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeJobInfoComponent } from './employee-job-info.component';
import { EmployeeDetailJobInformation } from '../../models/employee.model';
import { PeopleApiService } from '../../data-access/people-api.service';
import { WorkModeStore } from '../../../settings/state/work-mode.store';

describe('EmployeeJobInfoComponent', () => {
  let fixture: ComponentFixture<EmployeeJobInfoComponent>;
  let apiStub: Partial<PeopleApiService>;
  let storeStub: Partial<InstanceType<typeof WorkModeStore>>;

  const jobInfo: EmployeeDetailJobInformation = {
    employeeNumber: 'E-100', legalEntityId: 'le-1', legalEntityName: 'Acme Inc', departmentName: 'Engineering',
    positionName: 'Senior Engineer', positionId: 'pos-1', reportingManagerName: 'Jane Doe',
    employmentTypeLabel: 'Full-time', status: 'active', hireDate: '2026-01-01', probationEndDate: null,
    workModeLabel: 'Remote', employmentTypeCode: 'full_time', workModeId: 'wm-1'
  };

  beforeEach(async () => {
    apiStub = {
      checkEmployeeNumberAvailability: vi.fn().mockReturnValue(of({ employeeNumber: 'E-100', available: true }))
    };
    storeStub = {
      items: signal([
        {
          id: 'wm-1', legalEntityId: 'le-1', name: 'Remote', biometricEnabled: false, webEnabled: true,
          trayEnabled: false, photoRequired: false, isSystemSeeded: true, displayOrder: 0, isActive: true,
          createdAt: '', updatedAt: ''
        }
      ]) as any,
      atCap: signal(false) as any,
      loading: signal(false) as any,
      saving: signal(false) as any,
      error: signal(null) as any,
      load: vi.fn() as any,
      create: vi.fn() as any,
      update: vi.fn() as any,
      deactivate: vi.fn() as any
    };
    await TestBed.configureTestingModule({
      imports: [EmployeeJobInfoComponent],
      providers: [
        { provide: PeopleApiService, useValue: apiStub },
        { provide: WorkModeStore, useValue: storeStub }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(EmployeeJobInfoComponent);
    fixture.componentRef.setInput('jobInformation', jobInfo);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the position and department', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Senior Engineer');
    expect(text).toContain('Engineering');
  });

  it('shows a fallback for missing optional fields', async () => {
    fixture.componentRef.setInput('jobInformation', { ...jobInfo, positionName: null, departmentName: null, legalEntityName: null, reportingManagerName: null });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Unassigned');
  });

  it('renders the work mode', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Work Mode');
    expect(text).toContain('Remote');
  });

  it('shows a fallback when work mode is not resolved', () => {
    fixture.componentRef.setInput('jobInformation', { ...jobInfo, workModeLabel: null });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('—');
  });

  it('loads work modes scoped to the employee\'s legal entity', () => {
    expect(storeStub.load).toHaveBeenCalledWith('le-1');
  });

  it('does not render the Edit button when canEdit is false', () => {
    fixture.componentRef.setInput('canEdit', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="edit-job-details"]')).toBeNull();
  });

  it('renders the Edit button and shows the pre-filled form when canEdit is true', () => {
    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();
    const editButtonHost = fixture.nativeElement.querySelector('[data-testid="edit-job-details"]');
    expect(editButtonHost).not.toBeNull();

    // app-button renders a nested native <button> (see button.component.ts) - the (click)
    // listener lives there, not on the app-button host element the data-testid is attached to.
    editButtonHost.querySelector('button').click();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.isEditing()).toBe(true);
    expect(component.form.controls.employeeNumber.value).toBe('E-100');
    expect(component.form.controls.employmentTypeCode.value).toBe('full_time');
    expect(component.form.controls.workModeId.value).toBe('wm-1');
    expect(fixture.nativeElement.querySelector('[data-testid="save-job-details"]')).not.toBeNull();
  });

  it('cancelEdit() exits edit mode without emitting save', () => {
    const saveSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);
    fixture.componentInstance.startEdit();
    fixture.componentInstance.cancelEdit();
    expect(fixture.componentInstance.isEditing()).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('emits save with the form payload on submit', () => {
    const saveSpy = vi.fn();
    const component = fixture.componentInstance;
    component.save.subscribe(saveSpy);
    component.startEdit();
    component.form.setValue({ employeeNumber: 'E-200', employmentTypeCode: 'part_time', workModeId: 'wm-2' });
    component.employeeNumberAvailability.set('available');

    component.onSubmit();

    expect(saveSpy).toHaveBeenCalledWith({ employeeNumber: 'E-200', employmentTypeCode: 'part_time', workModeId: 'wm-2' });
  });

  it('sends workModeId as null when cleared', () => {
    const saveSpy = vi.fn();
    const component = fixture.componentInstance;
    component.save.subscribe(saveSpy);
    component.startEdit();
    component.form.setValue({ employeeNumber: 'E-100', employmentTypeCode: 'full_time', workModeId: '' });
    component.employeeNumberAvailability.set('available');

    component.onSubmit();

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ workModeId: null }));
  });

  it('does not emit save when the employee number is required but blank', () => {
    const saveSpy = vi.fn();
    const component = fixture.componentInstance;
    component.save.subscribe(saveSpy);
    component.startEdit();
    component.form.controls.employeeNumber.setValue('');

    component.onSubmit();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(component.employeeNumberFieldError()).toBe('Employee number is required.');
  });

  it('does not emit save when the async check reports the number is already in use', () => {
    const saveSpy = vi.fn();
    const component = fixture.componentInstance;
    component.save.subscribe(saveSpy);
    component.startEdit();
    component.form.controls.employeeNumber.setValue('TAKEN-001');
    component.employeeNumberAvailability.set('unavailable');

    component.onSubmit();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(component.employeeNumberFieldError()).toBe('This employee number is already in use.');
  });

  it('checks availability with excludeEmployeeId when the number changes to a new value', async () => {
    const component = fixture.componentInstance;
    component.startEdit();

    component.onEmployeeNumberChange('E-999');

    // debounceTime(350) uses the real async scheduler here (no fake timers installed) - wait it
    // out so the switchMap actually reaches the API call before asserting on it.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(apiStub.checkEmployeeNumberAvailability).toHaveBeenCalledWith('E-999', 'emp-1');
  });
});
