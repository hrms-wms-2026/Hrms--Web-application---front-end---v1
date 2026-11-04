/** The user's colour-mode preference. 'system' follows the OS (prefers-color-scheme) and updates live. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** What is actually painted: the preference with 'system' resolved. */
export type ResolvedThemeMode = 'light' | 'dark';

export interface ThemeModeOption {
  id: ThemeMode;
  label: string;
}

export const THEME_MODES: readonly ThemeModeOption[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' }
];

/** Everyone starts in Light; dark is opt-in (Dark, or System on a dark OS). */
export const DEFAULT_THEME_MODE: ThemeMode = 'light';

/**
 * localStorage key. Shared with the public landing page and read by the pre-boot script in
 * src/index.html (keep the key and values in sync there), so the right mode paints before Angular starts.
 */
export const THEME_MODE_STORAGE_KEY = 'onevo.color.mode';
