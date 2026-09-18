import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ColorSwatchPickerComponent } from './color-swatch-picker.component';

describe('ColorSwatchPickerComponent', () => {
  it('selects presets, shows native custom input without changing value, and emits custom colors', () => {
    TestBed.configureTestingModule({ imports: [ColorSwatchPickerComponent] });
    const fixture = TestBed.createComponent(ColorSwatchPickerComponent);
    fixture.componentRef.setInput('presets', [{ value: '#2563eb', label: 'Blue' }]);
    fixture.componentRef.setInput('selected', '#2563EB');
    const change = vi.fn();
    fixture.componentInstance.colorChange.subscribe(change);
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('[title="Blue"]')
        .classList.contains('proj-color-swatch--active'),
    ).toBe(true);
    fixture.nativeElement.querySelector('[title="Custom color"]').click();
    fixture.detectChanges();
    expect(change).not.toHaveBeenCalled();
    const input = fixture.nativeElement.querySelector('input[type="color"]') as HTMLInputElement;
    input.value = '#123456';
    input.dispatchEvent(new Event('input'));
    expect(change).toHaveBeenLastCalledWith('#123456');
    fixture.nativeElement.querySelector('[title="Blue"]').click();
    fixture.detectChanges();
    expect(change).toHaveBeenLastCalledWith('#2563eb');
    expect(fixture.nativeElement.querySelector('input[type="color"]')).toBeNull();
  });
});
