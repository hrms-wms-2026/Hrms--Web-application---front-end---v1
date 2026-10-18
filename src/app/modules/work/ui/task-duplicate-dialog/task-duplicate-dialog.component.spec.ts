import { pickSelectOption, selectDisplayText } from '../../../../shared/ui/select/select.testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TaskDuplicateDialogComponent, TaskDuplicateModuleOption, TaskDuplicatePayload } from './task-duplicate-dialog.component';

describe('TaskDuplicateDialogComponent', () => {
  let fixture: ComponentFixture<TaskDuplicateDialogComponent>;

  const modules: TaskDuplicateModuleOption[] = [
    { objectiveId: 'obj-1', title: 'Sprint Planning' },
    { objectiveId: 'obj-2', title: 'Backlog' }
  ];

  function setup(overrides: Record<string, unknown> = {}): void {
    TestBed.configureTestingModule({ imports: [TaskDuplicateDialogComponent] });
    fixture = TestBed.createComponent(TaskDuplicateDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('taskTitle', 'Fix the bug');
    fixture.componentRef.setInput('currentObjectiveId', 'obj-1');
    fixture.componentRef.setInput('modules', modules);
    for (const [key, value] of Object.entries(overrides)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  }

  function setInputValue(testId: string, value: string): void {
    const el = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
  }

  function setCheckbox(testId: string, checked: boolean): void {
    const el = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    el.checked = checked;
    el.dispatchEvent(new Event('change'));
  }

  it('prefills the title as "<original> (copy)" and preselects the current module', () => {
    setup();
    const titleInput = fixture.nativeElement.querySelector('[data-testid="duplicate-title-input"]') as HTMLInputElement;
    const moduleSelect = fixture.nativeElement.querySelector('[data-testid="duplicate-module-select"]') as HTMLElement;
    expect(titleInput.value).toBe('Fix the bug (copy)');
    expect(selectDisplayText(moduleSelect)).toBe(modules[0].title);
  });

  it('defaults Attachments, Assignees and Due date on, and Comments off', () => {
    setup();
    expect((fixture.nativeElement.querySelector('[data-testid="duplicate-copy-attachments"]') as HTMLInputElement).checked).toBe(true);
    expect((fixture.nativeElement.querySelector('[data-testid="duplicate-copy-assignees"]') as HTMLInputElement).checked).toBe(true);
    expect((fixture.nativeElement.querySelector('[data-testid="duplicate-copy-due-date"]') as HTMLInputElement).checked).toBe(true);
    expect((fixture.nativeElement.querySelector('[data-testid="duplicate-copy-comments"]') as HTMLInputElement).checked).toBe(false);
  });

  it('does not emit duplicated when the title is blank', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.duplicated.subscribe(spy);
    setInputValue('duplicate-title-input', '   ');

    (fixture.componentInstance as unknown as { confirm: () => void }).confirm();

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits duplicated with the current field values on confirm', () => {
    setup();
    const spy = vi.fn<(payload: TaskDuplicatePayload) => void>();
    fixture.componentInstance.duplicated.subscribe(spy);

    setInputValue('duplicate-title-input', 'Renamed copy');
    fixture.detectChanges();
    const moduleHost = fixture.nativeElement.querySelector('[data-testid="duplicate-module-select"]') as HTMLElement;
    pickSelectOption(moduleHost, modules[1].title, () => fixture.detectChanges());
    setCheckbox('duplicate-copy-comments', true);
    setCheckbox('duplicate-copy-attachments', false);

    (fixture.componentInstance as unknown as { confirm: () => void }).confirm();

    expect(spy).toHaveBeenCalledWith({
      title: 'Renamed copy', destinationObjectiveId: 'obj-2',
      copyAttachments: false, copyAssignees: true, copyComments: true, copyDueDate: true
    });
  });

  it('shows the error message when set', () => {
    setup({ error: 'This module is in an active event; a due date is required.' });
    expect(fixture.nativeElement.textContent).toContain('This module is in an active event');
  });

  it('resets the fields each time the dialog re-opens', () => {
    setup();
    setInputValue('duplicate-title-input', 'Something else entirely');
    fixture.detectChanges();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const titleInput = fixture.nativeElement.querySelector('[data-testid="duplicate-title-input"]') as HTMLInputElement;
    expect(titleInput.value).toBe('Fix the bug (copy)');
  });

  it('emits cancelled when the Cancel button is pressed', () => {
    setup();
    const spy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="duplicate-cancel-button"] button') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });
});
