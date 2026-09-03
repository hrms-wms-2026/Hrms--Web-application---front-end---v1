import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppearancePanelComponent } from './appearance-panel.component';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { ThemePresetId } from '../../../core/theme/models/theme-preset.model';

describe('AppearancePanelComponent', () => {
  it('renders 5 theme preset options', async () => {
    await TestBed.configureTestingModule({
      imports: [AppearancePanelComponent],
      providers: [{ provide: ThemeStore, useValue: { preset: signal<ThemePresetId>('default'), setPreset: vi.fn() } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppearancePanelComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[role="radio"]').length).toBe(5);
  });

  it('calls ThemeStore.setPreset when a theme option is selected', async () => {
    const setPreset = vi.fn();
    await TestBed.configureTestingModule({
      imports: [AppearancePanelComponent],
      providers: [{ provide: ThemeStore, useValue: { preset: signal<ThemePresetId>('default'), setPreset } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppearancePanelComponent);
    fixture.detectChanges();

    const emeraldOption = Array.from(fixture.nativeElement.querySelectorAll('[role="radio"]')).find((el) =>
      (el as HTMLElement).textContent?.includes('Emerald')
    ) as HTMLElement;

    emeraldOption.click();
    expect(setPreset).toHaveBeenCalledWith('emerald');
  });
});
