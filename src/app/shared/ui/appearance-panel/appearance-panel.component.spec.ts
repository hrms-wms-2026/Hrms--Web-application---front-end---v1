import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppearancePanelComponent } from './appearance-panel.component';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { ThemePresetId } from '../../../core/theme/models/theme-preset.model';
import { ResolvedThemeMode, ThemeMode } from '../../../core/theme/models/theme-mode.model';

function storeStub(overrides: Partial<{ mode: ThemeMode; resolved: ResolvedThemeMode }> = {}) {
  return {
    preset: signal<ThemePresetId>('default'),
    mode: signal<ThemeMode>(overrides.mode ?? 'light'),
    resolvedMode: signal<ResolvedThemeMode>(overrides.resolved ?? 'light'),
    setPreset: vi.fn(),
    setMode: vi.fn()
  };
}

async function setup(stub = storeStub()) {
  await TestBed.configureTestingModule({
    imports: [AppearancePanelComponent],
    providers: [{ provide: ThemeStore, useValue: stub }]
  }).compileComponents();
  const fixture = TestBed.createComponent(AppearancePanelComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, stub };
}

describe('AppearancePanelComponent', () => {
  it('renders 6 theme preset options', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('[aria-label="Theme Presets"] [role="radio"]').length).toBe(6);
  });

  it('calls ThemeStore.setPreset when a theme option is selected', async () => {
    const { el, stub } = await setup();
    const emeraldOption = Array.from(el.querySelectorAll('[aria-label="Theme Presets"] [role="radio"]')).find((option) =>
      option.textContent?.includes('Emerald')
    ) as HTMLElement;

    emeraldOption.click();
    expect(stub.setPreset).toHaveBeenCalledWith('emerald');
  });

  it('renders Light, Dark and System mode options with the current one checked', async () => {
    const { el } = await setup(storeStub({ mode: 'dark', resolved: 'dark' }));
    const options = Array.from(el.querySelectorAll('[aria-label="Colour mode"] [role="radio"]')) as HTMLElement[];

    expect(options.map((option) => option.textContent?.trim())).toEqual(['Light', 'Dark', 'System']);
    expect(options.map((option) => option.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
  });

  it('calls ThemeStore.setMode when a mode is selected', async () => {
    const { el, stub } = await setup();
    (el.querySelector('[data-mode-option="system"]') as HTMLElement).click();
    expect(stub.setMode).toHaveBeenCalledWith('system');
  });

  it('explains what System currently resolves to', async () => {
    const { el } = await setup(storeStub({ mode: 'system', resolved: 'dark' }));
    expect(el.querySelector('.mode-hint')?.textContent).toContain('Currently dark');
  });
});
