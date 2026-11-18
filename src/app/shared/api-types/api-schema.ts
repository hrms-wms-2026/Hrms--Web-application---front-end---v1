import type { components } from './backend-api.generated';

/** Every schema in the backend Swagger document, keyed by its full backend type name. */
export type ApiSchemas = components['schemas'];

/** One backend schema, e.g. `ApiSchema<'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest'>`. */
export type ApiSchema<K extends keyof ApiSchemas> = ApiSchemas[K];

/** Compiles only when `T` is `true`. Use it to turn a contract check into a build error. */
export type Assert<T extends true> = T;

/** Strips `readonly` from properties and arrays, so a read-only frontend DTO compares by shape. */
type DeepWritable<T> = T extends readonly (infer U)[]
  ? DeepWritable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
    : T;

type NoKeysMissingFrom<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? true : false;

/**
 * True when a hand-written DTO still fits the backend contract: the same field names both ways,
 * and every field type assignable to the backend's. The frontend may be stricter (non-null where
 * the backend says nullable, a string union where it says string, optional where the backend
 * declares nothing as required, `readonly` on properties and arrays).
 * A renamed, removed, added or retyped field makes it false.
 */
export type MatchesContract<Hand, Gen> = [DeepWritable<Hand>] extends [Partial<Gen>]
  ? NoKeysMissingFrom<Hand, Gen> extends true
    ? NoKeysMissingFrom<Gen, Hand>
    : false
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
