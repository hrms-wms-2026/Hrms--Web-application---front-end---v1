import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  TaskConvertToSubtaskCandidate,
  TaskConvertToSubtaskDialogComponent,
  TaskConvertToSubtaskPayload
} from './task-convert-to-subtask-dialog.component';

describe('TaskConvertToSubtaskDialogComponent', () => {
  let fixture: ComponentFixture<TaskConvertToSubtaskDialogComponent>;

  const candidates: TaskConvertToSubtaskCandidate[] = [
    { id: 'task-1', shortId: 'HW-20', title: 'Marketing — Build' },
    { id: 'task-3', shortId: 'HW-22', title: 'Task 3' }
  ];

  function setup(overrides: Record<string, unknown> = {}): void {
    TestBed.configureTestingModule({ imports: [TaskConvertToSubtaskDialogComponent] });
    fixture = TestBed.createComponent(TaskConvertToSubtaskDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('taskTitle', 'Task 2');
    fixture.componentRef.setInput('candidates', candidates);
    for (const [key, value] of Object.entries(overrides)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  }

  function setInputValue(testId: string, value: string): void {
    const el = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
  }

  function candidateButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="convert-subtask-candidate"]'));
  }

  it('lists every candidate task when the search box is empty', () => {
    setup();
    expect(candidateButtons()).toHaveLength(2);
  });

  it('filters candidates by title or short id as the user types', () => {
    setup();
    setInputValue('convert-subtask-search-input', 'HW-22');
    fixture.detectChanges();

    const buttons = candidateButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Task 3');
  });

  it('shows a plain confirm message when the task has no subtasks of its own', () => {
    setup({ hasOwnSubtasks: false });
    candidateButtons()[0].click();
    fixture.detectChanges();

    const message = fixture.nativeElement.querySelector('[data-testid="convert-subtask-confirm-message"]').textContent;
    expect(message).toContain('"Task 2" will become a subtask of "Marketing — Build"');
  });

  it('warns that the task\'s own subtasks will be reparented when it has some', () => {
    setup({ hasOwnSubtasks: true });
    candidateButtons()[0].click();
    fixture.detectChanges();

    const message = fixture.nativeElement.querySelector('[data-testid="convert-subtask-confirm-message"]').textContent;
    expect(message).toContain("subtasks will become subtasks of");
  });

  it('emits converted with the selected target id on confirm', () => {
    setup();
    const spy = vi.fn<(payload: TaskConvertToSubtaskPayload) => void>();
    fixture.componentInstance.converted.subscribe(spy);

    candidateButtons()[1].click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="convert-subtask-confirm-button"] button') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith({ newParentTaskId: 'task-3' });
  });

  it('returns to the search list when Back is pressed', () => {
    setup();
    candidateButtons()[0].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="convert-subtask-confirm-message"]')).toBeTruthy();

    (fixture.nativeElement.querySelector('[data-testid="convert-subtask-back-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="convert-subtask-confirm-message"]')).toBeFalsy();
    expect(candidateButtons()).toHaveLength(2);
  });

  it('shows the error message when set', () => {
    setup({ error: 'Only this milestone\'s owner can create subtasks.' });
    expect(fixture.nativeElement.textContent).toContain("Only this milestone's owner can create subtasks.");
  });

  it('resets the search term and selection each time the dialog re-opens', () => {
    setup();
    candidateButtons()[0].click();
    setInputValue('convert-subtask-search-input', 'irrelevant');
    fixture.detectChanges();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="convert-subtask-confirm-message"]')).toBeFalsy();
    expect((fixture.nativeElement.querySelector('[data-testid="convert-subtask-search-input"]') as HTMLInputElement).value).toBe('');
    expect(candidateButtons()).toHaveLength(2);
  });

  it('emits cancelled when the Cancel button is pressed', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="convert-subtask-cancel-button"] button') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });
});
