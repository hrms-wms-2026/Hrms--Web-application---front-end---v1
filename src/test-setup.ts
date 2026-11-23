/**
 * Global unit-test setup (angular.json → test.options.setupFiles).
 *
 * Vitest runs every spec file of a worker in one shared context (`isolate: false`), and this file runs again before
 * each spec file. So everything here is installed once per worker, and the `afterEach` below undoes the global
 * changes a spec can leave behind, whatever order the files run in.
 */
import { afterEach, vi } from 'vitest';

interface TestGlobals {
  __testSetupInstalled?: boolean;
  __nativeRequestAnimationFrame?: typeof requestAnimationFrame;
  __nativeCancelAnimationFrame?: typeof cancelAnimationFrame;
}
const testGlobals = globalThis as typeof globalThis & TestGlobals;

/**
 * Pins the default locale to en-US for every date and number formatter that is called without a locale
 * (`Intl.DateTimeFormat(undefined, ...)`, `date.toLocaleDateString()`, ...). The app formats in the user's browser
 * locale on purpose, but specs assert on text, so they must not depend on the locale of the machine that runs them:
 * on an en-GB machine "Aug 17" renders as "17 Aug" and the specs fail although the code is right. An explicit locale
 * passed by the code is kept.
 */
function pinDefaultLocale(): void {
  const TEST_LOCALE = 'en-US';
  type Locales = string | readonly string[] | undefined;
  const pick = (locales: unknown): string | string[] => (locales ?? TEST_LOCALE) as string | string[];

  // The same formatter class with a default locale: `new`, plain calls, statics and `instanceof` keep working.
  function withDefaultLocale<T extends abstract new (...args: never[]) => unknown>(native: T): T {
    return new Proxy(native, {
      construct: (target, [locales, options]: unknown[]) =>
        Reflect.construct(target as unknown as new (l: unknown, o: unknown) => object, [pick(locales), options]),
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
  // Keep the real frame functions before any spec can stub them away.
  testGlobals.__nativeRequestAnimationFrame = globalThis.requestAnimationFrame;
  testGlobals.__nativeCancelAnimationFrame = globalThis.cancelAnimationFrame;
  pinDefaultLocale();
}

/**
 * Undo what a spec can leave behind for the next file in the same worker. It runs after the spec's own `afterEach`.
 * Real timers come back first, so that restoring the globals afterwards is not undone by the fake-timer cleanup.
 */
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (typeof globalThis.requestAnimationFrame !== 'function' && testGlobals.__nativeRequestAnimationFrame) {
    globalThis.requestAnimationFrame = testGlobals.__nativeRequestAnimationFrame;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function' && testGlobals.__nativeCancelAnimationFrame) {
    globalThis.cancelAnimationFrame = testGlobals.__nativeCancelAnimationFrame;
  }
  // Specs fake the tab state with an own property on document; removing it brings back the real getter.
  Reflect.deleteProperty(document, 'visibilityState');
  Reflect.deleteProperty(document, 'hidden');
});
