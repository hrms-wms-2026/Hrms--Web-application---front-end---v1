import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { PreferencesModalComponent } from './preferences-modal.component';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { ThemePresetId } from '../../../core/theme/models/theme-preset.model';

describe('PreferencesModalComponent', () => {
  it('does not render when open is false', async () => {
    await TestBed.configureTestingModule({
      imports: [PreferencesModalComponent],
      providers: [
        {
          provide: ThemeStore,
          useValue: { preset: signal<ThemePresetId>('default'), setPreset: vi.fn() }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PreferencesModalComponent);
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.preferences-container')).toBeFalsy();
  });

  it('renders preferences tabs and theme presets when open', async () => {
    const setPreset = vi.fn();
    await TestBed.configureTestingModule({
      imports: [PreferencesModalComponent],
      providers: [
        {
          provide: ThemeStore,
          useValue: { preset: signal<ThemePresetId>('default'), setPreset }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PreferencesModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[role="radio"]');
    expect(options.length).toBe(5);
  });

  it('calls ThemeStore.setPreset when a theme option is selected', async () => {
    const setPreset = vi.fn();
    await TestBed.configureTestingModule({
      imports: [PreferencesModalComponent],
      providers: [
        {
          provide: ThemeStore,
          useValue: { preset: signal<ThemePresetId>('default'), setPreset }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PreferencesModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const emeraldOption = Array.from(fixture.nativeElement.querySelectorAll('[role="radio"]')).find((el) =>
      (el as HTMLElement).textContent?.includes('Emerald')
    ) as HTMLElement;

    emeraldOption.click();
    expect(setPreset).toHaveBeenCalledWith('emerald');
  });
});
