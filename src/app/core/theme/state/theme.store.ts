import { computed } from '@angular/core';
import { signalStore, withState, withMethods, withHooks, withComputed, patchState } from '@ngrx/signals';
import { DEFAULT_THEME_PRESET, THEME_PRESETS, ThemePresetId } from '../models/theme-preset.model';
import {
  DEFAULT_THEME_MODE,
  ResolvedThemeMode,
  THEME_MODES,
  THEME_MODE_STORAGE_KEY,
  ThemeMode
} from '../models/theme-mode.model';

const STORAGE_KEY = 'crownus.theme.preset';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeState {
  preset: ThemePresetId;
  mode: ThemeMode;
  /** Current OS preference; only used while mode is 'system'. */
  systemPrefersDark: boolean;
}

function isValidPreset(value: string | null): value is ThemePresetId {
  return !!value && THEME_PRESETS.some((option) => option.id === value);
}

function isValidMode(value: string | null): value is ThemeMode {
  return !!value && THEME_MODES.some((option) => option.id === value);
}

function readStoredPreset(): ThemePresetId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidPreset(stored) ? stored : DEFAULT_THEME_PRESET;
  } catch {
    // localStorage unavailable (private browsing, disabled storage) - fall back silently.
    return DEFAULT_THEME_PRESET;
  }
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isValidMode(stored) ? stored : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

function darkQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
}

function resolve(mode: ThemeMode, systemPrefersDark: boolean): ResolvedThemeMode {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

function applyPresetToDocument(preset: ThemePresetId): void {
  document.documentElement.setAttribute('data-theme', preset);
}

/** Both markers are set: theme-tokens.css and the Tailwind `dark:` variant match either. */
function applyModeToDocument(mode: ResolvedThemeMode): void {
  const root = document.documentElement;
  root.setAttribute('data-mode', mode);
  root.classList.toggle('dark', mode === 'dark');
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore persistence failures - the in-memory signal still reflects the choice.
  }
}

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  // Factory form (not a static object) so localStorage is re-read on every store
  // instantiation - a plain object would be captured once at module-evaluation time,
  // before any localStorage write, and never re-read (see theme.store.spec.ts).
  withState<ThemeState>(() => ({
    preset: readStoredPreset(),
    mode: readStoredMode(),
    systemPrefersDark: darkQuery()?.matches ?? false
  })),
  withComputed((store) => ({
    resolvedMode: computed<ResolvedThemeMode>(() => resolve(store.mode(), store.systemPrefersDark()))
  })),
  withMethods((store) => ({
    /**
     * Frontend-local persistence only (no backend theme-preference endpoint exists yet -
     * see FRONTEND_ORG_SETTINGS_AUDIT_AND_IMPLEMENTATION_PLAN.md §12 Part 2A). Swap the
     * body for a `PUT /api/v1/users/me/theme`-style call once one ships; callers of
     * setPreset don't need to change.
     */
    setPreset(preset: ThemePresetId): void {
      patchState(store, { preset });
      applyPresetToDocument(preset);
      persist(STORAGE_KEY, preset);
    },
    /** Light / Dark / System. Same local-only persistence as setPreset. */
    setMode(mode: ThemeMode): void {
      patchState(store, { mode });
      applyModeToDocument(resolve(mode, store.systemPrefersDark()));
      persist(THEME_MODE_STORAGE_KEY, mode);
    },
    /** Called by the prefers-color-scheme listener. */
    syncSystemPreference(prefersDark: boolean): void {
      patchState(store, { systemPrefersDark: prefersDark });
      if (store.mode() === 'system') applyModeToDocument(resolve('system', prefersDark));
    }
  })),
  withHooks((store) => {
    const query = darkQuery();
    const onChange = (event: MediaQueryListEvent): void => store.syncSystemPreference(event.matches);
    return {
      onInit(): void {
        applyPresetToDocument(store.preset());
        applyModeToDocument(store.resolvedMode());
        query?.addEventListener('change', onChange);
      },
      onDestroy(): void {
        query?.removeEventListener('change', onChange);
      }
    };
  })
);
