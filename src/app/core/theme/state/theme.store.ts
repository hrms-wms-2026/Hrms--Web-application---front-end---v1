import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { DEFAULT_THEME_PRESET, THEME_PRESETS, ThemePresetId } from '../models/theme-preset.model';

const STORAGE_KEY = 'onevo.theme.preset';

interface ThemeState {
  preset: ThemePresetId;
}

function isValidPreset(value: string | null): value is ThemePresetId {
  return !!value && THEME_PRESETS.some((option) => option.id === value);
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

function applyToDocument(preset: ThemePresetId): void {
  document.documentElement.setAttribute('data-theme', preset);
}

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  // Factory form (not a static object) so localStorage is re-read on every store
  // instantiation - a plain object would be captured once at module-evaluation time,
  // before any localStorage write, and never re-read (see theme.store.spec.ts).
  withState<ThemeState>(() => ({ preset: readStoredPreset() })),
  withMethods((store) => ({
    /**
     * Frontend-local persistence only (no backend theme-preference endpoint exists yet -
     * see FRONTEND_ORG_SETTINGS_AUDIT_AND_IMPLEMENTATION_PLAN.md §12 Part 2A). Swap the
     * body for a `PUT /api/v1/users/me/theme`-style call once one ships; callers of
     * setPreset don't need to change.
     */
    setPreset(preset: ThemePresetId): void {
      patchState(store, { preset });
      applyToDocument(preset);
      try {
        localStorage.setItem(STORAGE_KEY, preset);
      } catch {
        // Ignore persistence failures - the in-memory signal still reflects the choice.
      }
    }
  })),
  withHooks({
    onInit(store) {
      applyToDocument(store.preset());
    }
  })
);
