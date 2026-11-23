/**
 * Global unit-test setup (angular.json → test.options.setupFiles).
 *
 * Pins the default locale to en-US for every date and number formatter that is called without a locale
 * (`Intl.DateTimeFormat(undefined, ...)`, `date.toLocaleDateString()`, ...). The app formats in the user's browser
 * locale on purpose, but specs assert on text, so they must not depend on the locale of the machine that runs them:
 * on an en-GB machine "Aug 17" renders as "17 Aug" and the specs fail although the code is right.
 * An explicit locale passed by the code is kept.
 */
const TEST_LOCALE = 'en-US';

type Locales = string | readonly string[] | undefined;

const pick = (locales: unknown): string | string[] => (locales ?? TEST_LOCALE) as string | string[];

/** The same formatter class with a default locale: `new`, plain calls, statics and `instanceof` keep working. */
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
