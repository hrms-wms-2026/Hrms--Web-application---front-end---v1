import { TestBed } from '@angular/core/testing';
import { BulkTaskPickerDialogComponent, BulkTaskPickerMode } from './bulk-task-picker-dialog.component';

function create(mode: BulkTaskPickerMode, options = [{ value: 's1', label: 'Done' }]) {
  const fixture = TestBed.createComponent(BulkTaskPickerDialogComponent);
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('count', 3);
  fixture.componentRef.setInput('options', options);
  fixture.detectChanges();
  const confirmed = vi.fn();
  fixture.componentInstance.confirmed.subscribe(confirmed);
  return {
    fixture,
    inst: fixture.componentInstance as unknown as {
      value: { set(value: string): void };
      canSubmit(): boolean;
      submit(): void;
      clearDate(): void;
      title(): string;
    },
    confirmed
  };
}

describe('BulkTaskPickerDialogComponent', () => {
  it('titles by mode and count', () => {
    expect(create('status').inst.title()).toBe('Change status · 3 tasks');
    expect(create('parent').inst.title()).toBe('Convert to subtask · 3 tasks');
  });

  it('requires a value before submitting and emits it', () => {
    const { inst, confirmed } = create('status');
    expect(inst.canSubmit()).toBe(false);
    inst.value.set('s1');
    inst.submit();
    expect(confirmed).toHaveBeenCalledWith('s1');
  });

  it('priority mode offers the four priorities without needing options', () => {
    const { fixture } = create('priority', []);
    const options = (fixture.componentInstance as unknown as {
      effectiveOptions(): { value: string }[];
    }).effectiveOptions().map((option) => option.value);
    expect(options).toEqual(['low', 'medium', 'high', 'critical']);
  });

  it('due date mode can clear the date', () => {
    const { inst, confirmed } = create('dueDate', []);
    inst.clearDate();
    expect(confirmed).toHaveBeenCalledWith(null);
  });
});
