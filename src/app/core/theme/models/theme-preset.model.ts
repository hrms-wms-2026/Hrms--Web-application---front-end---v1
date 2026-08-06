export type ThemePresetId = 'default' | 'emerald' | 'violet' | 'rose' | 'slate';

export interface ThemePresetOption {
  id: ThemePresetId;
  label: string;
}

export const THEME_PRESETS: readonly ThemePresetOption[] = [
  { id: 'default', label: 'Default Blue' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'violet', label: 'Violet' },
  { id: 'rose', label: 'Rose' },
  { id: 'slate', label: 'Slate' }
];

export const DEFAULT_THEME_PRESET: ThemePresetId = 'default';
