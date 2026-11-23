/**
 * Global unit-test setup (angular.json → test.options.setupFiles).
 *
 * Vitest runs every spec file of a worker in one shared context (`isolate: false`), and this file runs again before
 * each spec file. So everything here is installed once per worker, and the hooks below undo the global changes a
 * spec can leave behind, whatever order the files run in.
 *
 * Rule for specs: fake timers, `vi.stubGlobal`, the timer globals, matchMedia and document.visibilityState are
 * reset around every test. Set them in `beforeEach` or in the test, never in `beforeAll` or a describe body.
 *
 * The timezone is not pinned on purpose: specs that format times pass an explicit `timeZone`.
 */
import { afterEach, beforeEach, vi } from 'vitest';

/** The timer globals fake timers replace. Their real versions are kept so a stale fake can never outlive its test. */
const TIMER_GLOBALS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'Date',
  'performance',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;
type TimerGlobal = (typeof TIMER_GLOBALS)[number];

interface TestGlobals {
  __testSetupInstalled?: boolean;
  __nativeTimers?: Partial<Record<TimerGlobal, unknown>>;
}
const testGlobals = globalThis as typeof globalThis & TestGlobals;

/**
 * Pins the default locale to en-US for every date and number formatter that is called without a locale
 * (`Intl.DateTimeFormat(undefined, ...)`, `date.toLocaleDateString()`, ...). The app formats in the user's browser
 * locale on purpose, but specs assert on text, so they must not depend on the locale of the machine that runs them:
 * on an en-GB machine "Aug 17" renders as "17 Aug" and the specs fail although the code is right. An explicit locale
 * passed by the code is kept. Covers DateTimeFormat, NumberFormat and the Date/Number toLocale* methods, which are the
 * formatters the app uses; Collator, PluralRules, ListFormat and RelativeTimeFormat are not pinned.
 */
function pinDefaultLocale(): void {
  const TEST_LOCALE = 'en-US';
  type Locales = string | readonly string[] | undefined;
  // undefined, null and [] all mean "the default locale".
  const pick = (locales: unknown): string | string[] =>
    (locales === undefined || locales === null || (Array.isArray(locales) && locales.length === 0) ? TEST_LOCALE : locales) as string | string[];

  // The same formatter class with a default locale: `new`, plain calls, statics and `instanceof` keep working.
  function withDefaultLocale<T extends abstract new (...args: never[]) => unknown>(native: T): T {
    return new Proxy(native, {
      construct: (target, [locales, options]: unknown[], newTarget: new (...args: unknown[]) => object) =>
        Reflect.construct(target as unknown as new (l: unknown, o: unknown) => object, [pick(locales), options], newTarget),
      apply: (target, thisArg, [locales, options]: unknown[]) =>
        Reflect.apply(target as unknown as (l: unknown, o: unknown) => unknown, thisArg, [pick(locales), options]),
    });
  }

  Intl.DateTimeFormat = withDefaultLocale(Intl.DateTimeFormat);
  Intl.NumberFormat = withDefaultLocale(Intl.NumberFormat);

  for (const method of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'] as const) {
    const native = Date.prototype[method] as (this: Date, locales?: Locales, options?: Intl.DateTimeFormatOptions) => string;
    Date.prototype[method] = function (this: Date, locales?: Locales, options?: Intl.DateTimeFormatOptions): string {
      return native.call(this, pick(locales), options);
    };
  }

  const nativeNumberToLocale = Number.prototype.toLocaleString as (this: number, locales?: Locales, options?: Intl.NumberFormatOptions) => string;
  Number.prototype.toLocaleString = function (this: number, locales?: Locales, options?: Intl.NumberFormatOptions): string {
    return nativeNumberToLocale.call(this, pick(locales), options);
  };
}

if (!testGlobals.__testSetupInstalled) {
  testGlobals.__testSetupInstalled = true;
  // Keep the real timer functions (zone.js-patched, as the specs expect) before any spec can fake or stub them.
  const natives: Partial<Record<TimerGlobal, unknown>> = {};
  for (const name of TIMER_GLOBALS) natives[name] = (globalThis as Record<string, unknown>)[name];
  testGlobals.__nativeTimers = natives;
  pinDefaultLocale();
}

/** Put back the timers and the tab state a spec may have faked or stubbed, so every test starts from the same globals. */
function restoreSharedGlobals(): void {
  // Always the real ones, not only when missing. A spy or stub made while fake timers were on remembers the fake as
  // its "original", so `restoreAllMocks` or `unstubAllGlobals` later puts back a stale fake that never fires: then
  // `await new Promise(r => setTimeout(r))` and `whenStable()` hang in an unrelated spec, and animations jump.
  for (const name of TIMER_GLOBALS) {
    const native = testGlobals.__nativeTimers?.[name];
    if (native !== undefined) (globalThis as Record<string, unknown>)[name] = native;
  }
  // Specs fake the tab state with an own property on document; removing it brings back the real getter.
  Reflect.deleteProperty(document, 'visibilityState');
  Reflect.deleteProperty(document, 'hidden');
  // jsdom has no matchMedia, so an own property on window is always a spec's stub (often "reduce motion").
  if (Object.prototype.hasOwnProperty.call(window, 'matchMedia')) Reflect.deleteProperty(window, 'matchMedia');
}

/**
 * Before each test: start from clean globals even if something outlived the previous test. `useFakeTimers` cannot
 * fake requestAnimationFrame while it is missing, so a missing one would silently turn animations into jumps.
 */
beforeEach(() => restoreSharedGlobals());

/**
 * After each test, after the spec's own `afterEach`: real timers come back first, so that restoring the globals
 * afterwards is not undone by the fake-timer cleanup.
 */
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  restoreSharedGlobals();
});
