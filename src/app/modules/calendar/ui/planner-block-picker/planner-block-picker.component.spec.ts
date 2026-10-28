import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PlannerFocusItem } from '../../../work/planner/models/planner.models';
import { PlannerBlockPickerComponent } from './planner-block-picker.component';

describe('PlannerBlockPickerComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PlannerBlockPickerComponent>>;
  const el = <T extends HTMLElement>(id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as T;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlannerBlockPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(PlannerBlockPickerComponent);
    fixture.componentRef.setInput('item', { taskId: 't1', title: 'Payroll export fix', remainingMinutes: 90 } as PlannerFocusItem);
    fixture.componentRef.setInput('editableDates', ['2026-11-02', '2026-11-03']);
    fixture.detectChanges();
  });

  it('defaults to the first day, 09:00 and the remaining estimate', () => {
    expect(el<HTMLSelectElement>('planner-picker-day').value).toBe('2026-11-02');
    expect(el<HTMLInputElement>('planner-picker-time').value).toBe('09:00');
    expect(el<HTMLSelectElement>('planner-picker-duration').value).toBe('90');
  });

  it('emits the chosen day, start and length', () => {
    const spy = vi.fn();
    fixture.componentInstance.submitted.subscribe(spy);
    const day = el<HTMLSelectElement>('planner-picker-day');
    day.value = '2026-11-03';
    day.dispatchEvent(new Event('change'));
    const time = el<HTMLInputElement>('planner-picker-time');
    time.value = '14:30';
    time.dispatchEvent(new Event('input'));
    const length = el<HTMLSelectElement>('planner-picker-duration');
    length.value = '45';
    length.dispatchEvent(new Event('change'));

    el<HTMLButtonElement>('planner-picker-save').click();

    expect(spy).toHaveBeenCalledWith({ date: '2026-11-03', startMinutes: 870, minutes: 45 });
  });

  it('uses 60 minutes without an estimate and can be cancelled', () => {
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.componentRef.setInput('item', { taskId: 't2', title: 'X', remainingMinutes: null } as PlannerFocusItem);
    fixture.detectChanges();

    expect(el<HTMLSelectElement>('planner-picker-duration').value).toBe('60');
    el<HTMLButtonElement>('planner-picker-cancel').click();
    expect(cancelled).toHaveBeenCalled();
  });
});
