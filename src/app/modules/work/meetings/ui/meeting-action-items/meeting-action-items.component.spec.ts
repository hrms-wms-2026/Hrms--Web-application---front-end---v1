import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../../core/auth/state/auth.store';
import { EmployeeDirectoryStore } from '../../../state/employee-directory.store';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingActionItemView } from '../../models/meeting.models';
import { MeetingActionItemsComponent } from './meeting-action-items.component';

describe('MeetingActionItemsComponent', () => {
  let fixture: ComponentFixture<MeetingActionItemsComponent>;
  const api = { listActionItems: vi.fn(), unlinkActionItem: vi.fn() };
  const item = (over: Partial<MeetingActionItemView> = {}): MeetingActionItemView => ({
    taskId: 'a1', shortId: 'ACME-7', title: 'Send the minutes', statusName: 'To do', objectiveId: 'o1',
    assigneeEmployeeId: 'e5', linkedByEmployeeId: 'e9', linkedAt: '2026-11-02T05:00:00Z', ...over,
  });

  async function build(items: MeetingActionItemView[], isOrganizer: boolean): Promise<void> {
    api.listActionItems.mockReturnValue(of(items));
    fixture = TestBed.createComponent(MeetingActionItemsComponent);
    fixture.componentRef.setInput('occurrenceTaskId', 'occ-1');
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('objectiveId', 'o1');
    fixture.componentRef.setInput('isOrganizer', isOrganizer);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const testIds = (id: string) => fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`) as NodeListOf<HTMLElement>;

  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    TestBed.configureTestingModule({
      providers: [
        { provide: MeetingApiService, useValue: api },
        { provide: AuthStore, useValue: { employeeId: () => 'e9' } },
        { provide: EmployeeDirectoryStore, useValue: { get: (id: string) => (id === 'e5' ? { id, name: 'Arjun M.' } : undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    TestBed.overrideComponent(MeetingActionItemsComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } });
  });

  it('lists the linked tasks with ShortId, status and assignee, and shows no count beyond the rows', async () => {
    await build([item()], false);
    const rows = testIds('action-item-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('ACME-7');
    expect(rows[0].textContent).toContain('Send the minutes');
    expect(rows[0].textContent).toContain('To do');
    expect(rows[0].textContent).toContain('Arjun M.');
    expect(fixture.nativeElement.textContent).not.toMatch(/\b\d+ (action items|items|hidden)\b/);
  });

  it('action item create passes the source occurrence', async () => {
    await build([], false);
    (fixture.nativeElement.querySelector('[data-testid="action-item-add"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const form = fixture.debugElement.query(By.css('app-task-form-modal'));
    expect(form).not.toBeNull();
    expect(form.properties['sourceMeetingOccurrenceId']).toBe('occ-1');
    expect(form.properties['prefillModuleId']).toBe('o1');
    expect(form.properties['projectId']).toBe('p1');
  });

  it('unlink is offered to the link creator and the organizer only', async () => {
    await build([item({ linkedByEmployeeId: 'e9' }), item({ taskId: 'a2', linkedByEmployeeId: 'someone-else' })], false);
    expect(testIds('action-item-unlink').length).toBe(1);

    await build([item({ linkedByEmployeeId: 'someone-else' })], true);
    expect(testIds('action-item-unlink').length).toBe(1);
  });

  it('unlinking removes only the link and reloads the list', async () => {
    await build([item()], true);
    api.unlinkActionItem.mockReturnValue(of(undefined));
    api.listActionItems.mockReturnValue(of([]));
    testIds('action-item-unlink')[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.unlinkActionItem).toHaveBeenCalledWith('occ-1', 'a1');
    expect(testIds('action-item-row').length).toBe(0);
  });
});
