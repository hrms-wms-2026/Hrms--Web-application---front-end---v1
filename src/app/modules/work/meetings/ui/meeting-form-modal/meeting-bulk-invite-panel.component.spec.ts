import { vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DepartmentApiService } from '../../../../organization/data-access/department-api.service';
import { LegalEntityApiService } from '../../../../organization/data-access/legal-entity-api.service';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingBulkPreviewResponse } from '../../models/meeting.models';
import { MeetingBulkInvitePanelComponent } from './meeting-bulk-invite-panel.component';

describe('MeetingBulkInvitePanelComponent', () => {
  let fixture: ComponentFixture<MeetingBulkInvitePanelComponent>;
  let panel: MeetingBulkInvitePanelComponent;
  const bulkPreview = vi.fn();

  const preview = (over: Partial<MeetingBulkPreviewResponse> = {}): MeetingBulkPreviewResponse => ({
    people: [
      { employeeId: 'a', name: 'Arjun M.', email: 'a@x.com', departmentName: 'Engineering' },
      { employeeId: 'b', name: 'Bala K.', email: 'b@x.com', departmentName: 'Engineering' },
      { employeeId: 'c', name: 'Chitra R.', email: null, departmentName: 'Engineering' },
    ],
    selected: 5, duplicatesRemoved: 1, inactiveExcluded: 1, alreadyInvited: 1, capacityWarning: null, ...over,
  });

  beforeEach(() => {
    bulkPreview.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: MeetingApiService, useValue: { bulkPreview } },
        { provide: LegalEntityApiService, useValue: { getLegalEntities: () => of([{ id: 'le1', name: 'Acme' }]) } },
        { provide: DepartmentApiService, useValue: { listFlat: () => of({ items: [{ id: 'd1', name: 'Engineering' }], page: 1, pageSize: 100, totalCount: 1 }) } },
      ],
    });
    TestBed.overrideComponent(MeetingBulkInvitePanelComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } });
    fixture = TestBed.createComponent(MeetingBulkInvitePanelComponent);
    panel = fixture.componentInstance;
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('objectiveId', 'o1');
    fixture.componentRef.setInput('platform', 'zoom');
    fixture.detectChanges();
  });

  it('says what to pick while Preview cannot run, and looks disabled', () => {
    // A disabled Preview looked like any other button, so a click seemed to do nothing.
    const button = () => fixture.nativeElement.querySelector('[data-testid="bulk-preview"]') as HTMLButtonElement;
    const hint = () => fixture.nativeElement.querySelector('[data-testid="bulk-preview-hint"]') as HTMLElement | null;

    expect(button().disabled).toBe(true);
    expect(button().className).toContain('disabled:opacity-50');
    expect(hint()?.textContent).toContain('Pick a department or a manager');

    panel.toggleDepartment('d1');
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
    expect(hint()).toBeNull();
  });

  it('bulk preview merges only the kept people and shows the counts line', async () => {
    bulkPreview.mockReturnValue(of(preview()));
    panel.toggleDepartment('d1');
    await panel.preview();
    fixture.detectChanges();

    expect(bulkPreview).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p1', objectiveId: 'o1', departmentIds: ['d1'], managerEmployeeIds: [], platform: 'zoom',
    }));
    expect(fixture.nativeElement.querySelector('[data-testid="bulk-counts"]').textContent.trim())
      .toBe('Selected 5 · 1 duplicates removed · 1 inactive excluded · 1 already invited');

    panel.remove('b');
    let added: readonly string[] = [];
    panel.added.subscribe((ids) => (added = ids));
    fixture.detectChanges();
    const addButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="bulk-add"]');
    expect(addButton.textContent?.trim()).toBe('Add 2 people');
    addButton.click();

    expect(added).toEqual(['a', 'c']);
  });

  it('the add button is drawn in the theme accent, so it shows on the white dialog', async () => {
    bulkPreview.mockReturnValue(of(preview()));
    panel.toggleDepartment('d1');
    await panel.preview();
    fixture.detectChanges();

    const add: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="bulk-add"]');
    expect(add.className).toContain('bg-[var(--color-accent)]');
    expect(add.className).toContain('text-[var(--color-accent-contrast)]');
  });

  it('capacity warning does not block', async () => {
    bulkPreview.mockReturnValue(of(preview({ capacityWarning: 'This meeting will have 304 people; Zoom meetings support up to 300.' })));
    panel.toggleDepartment('d1');
    await panel.preview();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="bulk-capacity-warning"]').textContent)
      .toContain('Zoom meetings support up to 300');
    expect((fixture.nativeElement.querySelector('[data-testid="bulk-add"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('hides itself when bulk invite is unavailable', async () => {
    bulkPreview.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'bulk_invite_unavailable' } })));
    panel.toggleDepartment('d1');
    await panel.preview();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="meeting-bulk-panel"]')).toBeNull();
  });
});
