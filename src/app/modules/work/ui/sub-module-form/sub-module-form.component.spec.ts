import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SubModuleFormComponent } from './sub-module-form.component';
import { ObjectiveDetail } from '../../models/milestone.model';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('SubModuleFormComponent', () => {
  let fixture: ComponentFixture<SubModuleFormComponent>;
  let store: { uploadMilestoneAsset: ReturnType<typeof vi.fn>; deleteMilestoneAsset: ReturnType<typeof vi.fn>; milestoneActionError: ReturnType<typeof vi.fn> };
  let currentActionError: string | null;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: 'parent-1', isDefault: false,
    title: 'Design Phase', description: 'Scope design', ownerId: 'u1', ownerName: 'Arun',
    reportingManagerId: 'm1', reportingManagerName: 'Manager', createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
    allocatedHours: 20, completedHours: 0, isActive: true, isOwner: true,
    isAchieved: false, achievedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
    assets: [{ id: 'a1', fileName: 'existing.pdf', sizeBytes: 1024, contentType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00Z', downloadUrl: 'https://signed.example/existing.pdf' }]
  };

  beforeEach(() => {
    currentActionError = null;
    store = {
      uploadMilestoneAsset: vi.fn(),
      deleteMilestoneAsset: vi.fn(),
      milestoneActionError: vi.fn(() => currentActionError)
    };
    TestBed.configureTestingModule({
      imports: [SubModuleFormComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: store },
        { provide: EmployeeDirectoryStore, useValue: { get: () => ({ name: 'Nadia Shah' }), ensureLoaded: vi.fn() } }
      ]
    });
    fixture = TestBed.createComponent(SubModuleFormComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('emits the create payload with headEmployeeId/memberInvitations built from picked members', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('New Module');
    component.description.set('Details');
    component.startDate.set('2026-04-01');
    component.endDate.set('2026-05-01');
    component.allocatedHours.set(12);
    component.onMemberPicked('emp-1');
    component.onMemberPicked('emp-2');
    component.onSetOwner('emp-2');
    const created = vi.fn();
    component.created.subscribe(created);

    component.submit();

    expect(created).toHaveBeenCalledWith({
      payload: {
        parentObjectiveId: 'parent-1', title: 'New Module', description: 'Details',
        startDate: '2026-04-01', endDate: '2026-05-01', allocatedHours: 12,
        headEmployeeId: 'emp-2', memberInvitations: [{ employeeId: 'emp-1', type: 'member' }]
      },
      assetFiles: []
    });
  });

  it('has no Members section in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="members-section"]')).toBeNull();
  });

  it('emits staged files as assetFiles on create submit, without uploading them', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('New Module');
    component.startDate.set('2026-04-01');
    component.endDate.set('2026-05-01');
    const file = new File(['content'], 'plan.pdf', { type: 'application/pdf' });
    component.onAssetFilesPicked([file]);
    const created = vi.fn();
    component.created.subscribe(created);

    component.submit();

    expect(store.uploadMilestoneAsset).not.toHaveBeenCalled();
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ assetFiles: [file] }));
  });

  it('prefills existing assets in edit mode as uploaded rows', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    expect(component.assetRows()).toEqual([{ id: 'a1', fileName: 'existing.pdf', sizeBytes: 1024, status: 'uploaded' }]);
  });

  it('uploads a picked file immediately in edit mode and marks it uploaded on success', async () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const uploaded = { id: 'a2', fileName: 'new.pdf', sizeBytes: 512, contentType: 'application/pdf', uploadedAt: '2026-01-02T00:00:00Z', downloadUrl: 'https://signed.example/new.pdf' };
    store.uploadMilestoneAsset.mockResolvedValue({ success: true, asset: uploaded });
    const file = new File(['content'], 'new.pdf', { type: 'application/pdf' });

    component.onAssetFilesPicked([file]);
    expect(component.assetRows().find((r: any) => r.fileName === 'new.pdf').status).toBe('uploading');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.uploadMilestoneAsset).toHaveBeenCalledWith('o1', file);
    expect(component.assetRows().find((r: any) => r.id === 'a2').status).toBe('uploaded');
  });

  it('marks a failed edit-mode upload as error with the store\'s real server-error detail, and allows retry', async () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    currentActionError = 'File type .exe is not allowed.';
    store.uploadMilestoneAsset.mockResolvedValueOnce({ success: false });
    const file = new File(['content'], 'bad.exe', { type: 'application/x-msdownload' });

    component.onAssetFilesPicked([file]);
    await Promise.resolve();
    await Promise.resolve();

    const failedRow = component.assetRows().find((r: any) => r.fileName === 'bad.exe');
    expect(failedRow.status).toBe('error');
    expect(failedRow.errorMessage).toBe('File type .exe is not allowed.');

    currentActionError = null;
    store.uploadMilestoneAsset.mockResolvedValue({ success: true, asset: { id: 'a3', fileName: 'bad.exe', sizeBytes: 1, contentType: 'x', uploadedAt: 'now', downloadUrl: 'x' } });
    component.onAssetRetry(failedRow.id);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.assetRows().find((r: any) => r.id === 'a3').status).toBe('uploaded');
  });

  it('deletes an uploaded asset immediately in edit mode on remove', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    store.deleteMilestoneAsset.mockResolvedValue({ success: true });

    component.onAssetRemove('a1');

    expect(store.deleteMilestoneAsset).toHaveBeenCalledWith('o1', 'a1');
    expect(component.assetRows()).toEqual([]);
  });

  it('retries a failed delete when Remove is clicked again, surfacing the store\'s real error, and removes the row once it succeeds', async () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    currentActionError = 'This file is still attached to an open task.';
    store.deleteMilestoneAsset.mockResolvedValueOnce({ success: false });

    component.onAssetRemove('a1');
    await Promise.resolve();
    await Promise.resolve();

    const failedRow = component.assetRows().find((r: any) => r.id === 'a1');
    expect(failedRow.status).toBe('error');
    expect(failedRow.errorMessage).toBe('This file is still attached to an open task.');

    currentActionError = null;
    store.deleteMilestoneAsset.mockResolvedValue({ success: true });
    component.onAssetRemove('a1');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.deleteMilestoneAsset).toHaveBeenCalledTimes(2);
    expect(store.deleteMilestoneAsset).toHaveBeenNthCalledWith(2, 'o1', 'a1');
    expect(component.assetRows().find((r: any) => r.id === 'a1')).toBeUndefined();
  });

  it('retries a failed delete when Retry is clicked, and removes the row once it succeeds', async () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    store.deleteMilestoneAsset.mockResolvedValueOnce({ success: false });

    component.onAssetRemove('a1');
    await Promise.resolve();
    await Promise.resolve();
    expect(component.assetRows().find((r: any) => r.id === 'a1').status).toBe('error');

    store.deleteMilestoneAsset.mockResolvedValue({ success: true });
    component.onAssetRetry('a1');
    await Promise.resolve();
    await Promise.resolve();

    expect(store.deleteMilestoneAsset).toHaveBeenCalledTimes(2);
    expect(store.deleteMilestoneAsset).toHaveBeenNthCalledWith(2, 'o1', 'a1');
    expect(component.assetRows().find((r: any) => r.id === 'a1')).toBeUndefined();
  });

  it('prefills edit mode and emits fields with achieved metadata', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('Updated Module');
    const saved = vi.fn();
    component.saved.subscribe(saved);

    component.submit();

    expect(component.description()).toBe('Scope design');
    expect(saved).toHaveBeenCalledWith({
      fields: {
        title: 'Updated Module', description: 'Scope design',
        startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 20
      },
      achievedChanged: false,
      achieved: false
    });
  });

  it('shows the Default Module explanation and disables Achieved in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', { ...detail, isDefault: true });
    fixture.detectChanges();
    const achieved = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input') as HTMLInputElement;

    expect(achieved.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Default Module follows');
  });

  it('blocks invalid create values and shows field errors', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const created = vi.fn();
    (fixture.componentInstance as any).created.subscribe(created);

    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(created).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });
});
