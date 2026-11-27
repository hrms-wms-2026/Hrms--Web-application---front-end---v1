import type { components } from './backend-api.generated';

/** Every schema in the backend Swagger document, keyed by its full backend type name. */
export type ApiSchemas = components['schemas'];

/** One backend schema, e.g. `ApiSchema<'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest'>`. */
export type ApiSchema<K extends keyof ApiSchemas> = ApiSchemas[K];

/** Compiles only when `T` is `true`. Use it to turn a contract check into a build error. */
export type Assert<T extends true> = T;

/**
 * Strips `readonly` from properties and arrays, so a read-only frontend DTO compares by shape.
 * Intended for JSON DTO shapes (no tuples or functions).
 */
type DeepWritable<T> = T extends readonly (infer U)[]
  ? DeepWritable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
    : T;

type NoKeysMissingFrom<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? true : false;

/** Same field names both ways, at every level: nested objects and array elements included. */
type KeysMatchDeep<H, G> = [NonNullable<H>] extends [readonly (infer HU)[]]
  ? [NonNullable<G>] extends [readonly (infer GU)[]]
    ? KeysMatchDeep<HU, GU>
    : true
  : [NonNullable<H>, NonNullable<G>] extends [object, object]
    ? NoKeysMissingFrom<NonNullable<H>, NonNullable<G>> extends true
      ? NoKeysMissingFrom<NonNullable<G>, NonNullable<H>> extends true
        ? [
            {
              [K in keyof NonNullable<H> & keyof NonNullable<G>]-?: KeysMatchDeep<
                NonNullable<H>[K],
                NonNullable<G>[K]
              >;
            }[keyof NonNullable<H> & keyof NonNullable<G>],
          ] extends [true]
          ? true
          : false
        : false
      : false
    : true;

/**
 * True when a hand-written DTO still fits the backend contract: the same field names both ways
 * (checked at every level, including nested objects and array elements), and every field type
 * assignable to the backend's. The frontend may be stricter (non-null where the backend says
 * nullable, a string union where it says string, `readonly` on properties and arrays) and may
 * mark a field optional (not checked against the backend, which declares nothing as required).
 * A renamed, removed, added or retyped field makes it false.
 */
export type MatchesContract<Hand, Gen> = [DeepWritable<Hand>] extends [Partial<Gen>]
  ? KeysMatchDeep<Hand, Gen>
  : false;

/** True when the hand-written DTO is exactly the generated one, so it can become an alias. */
export type SameAsContract<Hand, Gen> =
  MatchesContract<Hand, Gen> extends true
    ? [Gen] extends [Hand]
      ? [DeepWritable<Hand>] extends [Gen]
        ? true
        : false
      : false
    : false;
