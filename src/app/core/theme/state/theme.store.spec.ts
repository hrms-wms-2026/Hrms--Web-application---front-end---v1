import { TestBed } from '@angular/core/testing';
import { ThemeStore } from './theme.store';

const STORAGE_KEY = 'onevo.theme.preset';

describe('ThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to the default preset and applies it to the document root when nothing is stored', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(ThemeStore);

    expect(store.preset()).toBe('default');
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
  });

  it('restores a previously persisted preset on init', () => {
    localStorage.setItem(STORAGE_KEY, 'emerald');
    TestBed.configureTestingModule({});
    const store = TestBed.inject(ThemeStore);

    expect(store.preset()).toBe('emerald');
    expect(document.documentElement.getAttribute('data-theme')).toBe('emerald');
  });

  it('ignores an invalid stored value and falls back to default', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-real-preset');
    TestBed.configureTestingModule({});
    const store = TestBed.inject(ThemeStore);

    expect(store.preset()).toBe('default');
  });

  it('setPreset updates the signal, the document attribute, and persists to localStorage', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(ThemeStore);

    store.setPreset('violet');

    expect(store.preset()).toBe('violet');
    expect(document.documentElement.getAttribute('data-theme')).toBe('violet');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('violet');
  });

  it('cycles through every preset, always leaving the signal, the DOM attribute, and storage in agreement', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(ThemeStore);

    for (const preset of ['emerald', 'violet', 'rose', 'slate', 'default'] as const) {
      store.setPreset(preset);
      expect(store.preset()).toBe(preset);
      expect(document.documentElement.getAttribute('data-theme')).toBe(preset);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(preset);
    }
  });

  // NOTE: this test suite runs under jsdom (see package.json), which does not load or
  // apply external stylesheets, so getComputedStyle() on document.documentElement cannot
  // see theme-tokens.css's [data-theme] rules here - a computed-style assertion would
  // silently no-op rather than catch a real regression. That the [data-theme] attribute
  // actually re-skins the app (distinct --color-accent per preset reaching rendered
  // elements) is verified instead by inspecting the built CSS output - see the Part 2A
  // report's Theme verification section.
});
