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
    TestBed.configureTestingModule({
      imports: [BoardStructureEditorComponent],
      providers: [{ provide: TaskApiService, useValue: { reorderTaskStatuses } }]
    });
    const fixture = TestBed.createComponent(BoardStructureEditorComponent);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('statuses', statuses);
    return { fixture, reorderTaskStatuses };
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

    const saveButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
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
});
