import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { BoardStructureEditorComponent } from './board-structure-editor.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskStatusColumn } from '../../models/task.model';
import { TaskStatusDto } from '../../models/dto/task.dto';

describe('BoardStructureEditorComponent', () => {
  // Deliberately out of DisplayOrder in the source array (Done comes first, Review comes last) to
  // prove the component sorts by displayOrder rather than trusting input array order.
  const statuses: TaskStatusColumn[] = [
    { id: 's4', name: 'Done', displayOrder: 3, requiresApproval: false, marksTaskComplete: true, visibility: 'public' },
    { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public' },
    { id: 's3', name: 'Review', displayOrder: 2, requiresApproval: false, marksTaskComplete: false, visibility: 'private' },
    { id: 's2', name: 'In Process', displayOrder: 1, requiresApproval: false, marksTaskComplete: false, visibility: 'public' }
  ];

  function setup() {
    const reorderTaskStatuses = vi.fn().mockReturnValue(of([] as TaskStatusDto[]));
    const createStatus = vi.fn().mockReturnValue(of({
      id: 's5', name: 'Blocked', displayOrder: 4, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public'
    } as TaskStatusDto));
    const deleteStatus = vi.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [BoardStructureEditorComponent],
      providers: [{ provide: TaskApiService, useValue: { reorderTaskStatuses, createStatus, deleteStatus } }]
    });
    const fixture = TestBed.createComponent(BoardStructureEditorComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('statuses', statuses);
    return { fixture, reorderTaskStatuses, createStatus, deleteStatus };
  }

  it('renders one row per status, in DisplayOrder, with a checkbox for private and a radio for complete', () => {
    const { fixture } = setup();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.board-structure__row');
    expect(rows.length).toBe(4);

    const names = Array.from(rows as NodeListOf<HTMLElement>).map((row) => row.querySelector('.board-structure__name')?.textContent?.trim());
    expect(names).toEqual(['To Do', 'In Process', 'Review', 'Done']);

    const checkboxes = Array.from(rows as NodeListOf<HTMLElement>).map((row) => (row.querySelector('input[type="checkbox"]') as HTMLInputElement).checked);
    expect(checkboxes).toEqual([false, false, true, false]);

    const radios = Array.from(rows as NodeListOf<HTMLElement>).map((row) => (row.querySelector('input[type="radio"]') as HTMLInputElement).checked);
    expect(radios).toEqual([false, false, false, true]);
    expect(radios.filter(Boolean).length).toBe(1);
  });

  it('save button posts the current row order/visibility/complete-flag as one reorderTaskStatuses call', async () => {
    const { fixture, reorderTaskStatuses } = setup();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.board-structure__row');
    const reviewCheckbox = rows[2].querySelector('input[type="checkbox"]') as HTMLInputElement;
    reviewCheckbox.click();
    fixture.detectChanges();

    const saveButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.includes('Update'))!;
    saveButton.click();
    await fixture.whenStable();

    expect(reorderTaskStatuses).toHaveBeenCalledTimes(1);
    expect(reorderTaskStatuses).toHaveBeenCalledWith('obj-1', [
      { statusId: 's1', displayOrder: 0, visibility: 'public', marksTaskComplete: false },
      { statusId: 's2', displayOrder: 1, visibility: 'public', marksTaskComplete: false },
      { statusId: 's3', displayOrder: 2, visibility: 'public', marksTaskComplete: false },
      { statusId: 's4', displayOrder: 3, visibility: 'public', marksTaskComplete: true }
    ]);
  });

  it('onDrop reorders the rows and save posts the new order, not the original sorted order', async () => {
    const { fixture, reorderTaskStatuses } = setup();
    fixture.detectChanges();

    // Move the row at index 0 ('To Do', s1) to index 2, landing after 'Review' (s3):
    // starting order [s1, s2, s3, s4] -> [s2, s3, s1, s4]
    fixture.componentInstance.onDrop({ previousIndex: 0, currentIndex: 2 } as Parameters<typeof fixture.componentInstance.onDrop>[0]);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.board-structure__row');
    const names = Array.from(rows as NodeListOf<HTMLElement>).map((row) => row.querySelector('.board-structure__name')?.textContent?.trim());
    expect(names).toEqual(['In Process', 'Review', 'To Do', 'Done']);

    const saveButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.includes('Update'))!;
    saveButton.click();
    await fixture.whenStable();

    expect(reorderTaskStatuses).toHaveBeenCalledTimes(1);
    expect(reorderTaskStatuses).toHaveBeenCalledWith('obj-1', [
      { statusId: 's2', displayOrder: 0, visibility: 'public', marksTaskComplete: false },
      { statusId: 's3', displayOrder: 1, visibility: 'private', marksTaskComplete: false },
      { statusId: 's1', displayOrder: 2, visibility: 'public', marksTaskComplete: false },
      { statusId: 's4', displayOrder: 3, visibility: 'public', marksTaskComplete: true }
    ]);
  });

  it('changing which radio is checked moves MarksTaskComplete to exactly the new selection', () => {
    const { fixture } = setup();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.board-structure__row');
    const toDoRadio = rows[0].querySelector('input[type="radio"]') as HTMLInputElement;
    toDoRadio.click();
    fixture.detectChanges();

    const radios = Array.from(rows as NodeListOf<HTMLElement>).map((row) => (row.querySelector('input[type="radio"]') as HTMLInputElement).checked);
    expect(radios).toEqual([true, false, false, false]);
    expect(radios.filter(Boolean).length).toBe(1);
  });

  it('the + icon reveals a name field, and confirming creates the status and appends a row', async () => {
    const { fixture, createStatus } = setup();
    fixture.detectChanges();

    const addIcon = fixture.nativeElement.querySelector('.board-structure__add-icon') as HTMLButtonElement;
    addIcon.click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.board-structure__new-input') as HTMLInputElement;
    input.value = 'Blocked';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const addButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.trim() === 'Add')!;
    addButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createStatus).toHaveBeenCalledWith('obj-1', {
      name: 'Blocked', displayOrder: 4, visibility: 'public', marksTaskComplete: false, requiresApproval: false
    });
    const names = Array.from(fixture.nativeElement.querySelectorAll('.board-structure__name') as NodeListOf<HTMLElement>)
      .map((el) => el.textContent?.trim());
    expect(names).toContain('Blocked');
    // The inline add form collapses back to the + icon after a successful add.
    expect(fixture.nativeElement.querySelector('.board-structure__new-input')).toBeNull();
  });

  it('the delete icon on a row deletes that status and removes its row', async () => {
    const { fixture, deleteStatus } = setup();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.board-structure__row');
    const reviewDelete = rows[2].querySelector('.board-structure__delete-icon') as HTMLButtonElement;
    reviewDelete.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(deleteStatus).toHaveBeenCalledWith('s3');
    const names = Array.from(fixture.nativeElement.querySelectorAll('.board-structure__name') as NodeListOf<HTMLElement>)
      .map((el) => el.textContent?.trim());
    expect(names).toEqual(['To Do', 'In Process', 'Done']);
  });

  it('emits saved after a create or delete, so the parent reloads its own statuses list', async () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    const rows = fixture.nativeElement.querySelectorAll('.board-structure__row');
    (rows[0].querySelector('.board-structure__delete-icon') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(saved).toHaveBeenCalledTimes(1);
  });
});
