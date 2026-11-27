import { describe, expect, it } from 'vitest';
import type { ApiSchema, Assert, MatchesContract, SameAsContract } from './api-schema';

interface Gen {
  id: string;
  name: string | null;
  count: number;
}

// A frontend type may be stricter (non-null, optional) but must have the same keys and compatible types.
type _ok = Assert<MatchesContract<{ id: string; name: string; count: number }, Gen>>;
type _optional = Assert<MatchesContract<{ id: string; name?: string | null; count: number }, Gen>>;
// @ts-expect-error a renamed field is drift
type _renamed = Assert<MatchesContract<{ id: string; title: string; count: number }, Gen>>;
// @ts-expect-error a field the backend has but the frontend dropped is drift
type _missing = Assert<MatchesContract<{ id: string; name: string }, Gen>>;
interface Extra {
  id: string;
  name: string;
  count: number;
  more: boolean;
}
// @ts-expect-error a field the frontend sends but the backend does not know is drift
type _extra = Assert<MatchesContract<Extra, Gen>>;
// @ts-expect-error a changed field type is drift
type _retyped = Assert<MatchesContract<{ id: string; name: string; count: string }, Gen>>;

type _same = Assert<SameAsContract<Gen, Gen>>;
// @ts-expect-error a narrower frontend type is not "the same", so it must stay hand-written
type _narrower = Assert<SameAsContract<{ id: string; name: string; count: number }, Gen>>;

// The lookup resolves real generated keys.
type _lookup = Assert<
  MatchesContract<
    ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>,
    ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>
  >
>;

interface GenItem {
  id: string;
  tags: string[] | null;
}
interface GenWithArrays {
  items: GenItem[] | null;
  ids: string[];
  title: string | null;
}
interface ReadonlyItem {
  readonly id: string;
  readonly tags: readonly string[];
}
interface ReadonlyHand {
  readonly items: readonly ReadonlyItem[];
  readonly ids: readonly string[];
  readonly title: string;
}
interface WrongElementHand {
  readonly items: readonly ReadonlyItem[];
  readonly ids: readonly number[];
  readonly title: string;
}
// Frontend `readonly` (properties and arrays, also nested) is not drift.
type _readonly = Assert<MatchesContract<ReadonlyHand, GenWithArrays>>;
// @ts-expect-error a readonly array with the wrong element type is still drift
type _readonlyWrong = Assert<MatchesContract<WrongElementHand, GenWithArrays>>;

interface GenNested {
  id: string;
  child: { a: string; b: number } | null;
  rows: { x: string; y: number }[] | null;
}
interface NestedOk {
  id: string;
  child: { a: string; b: number };
  rows: readonly { readonly x: string; readonly y: number }[];
}
interface NestedExtraObject {
  id: string;
  child: { a: string; b: number; c: boolean };
  rows: { x: string; y: number }[];
}
interface NestedExtraElement {
  id: string;
  child: { a: string; b: number };
  rows: { x: string; y: number; z: boolean }[];
}
interface NestedRenamed {
  id: string;
  child: { a: string; bee: number };
  rows: { x: string; y: number }[];
}
// Nested object, array element and nullable nested object all match.
type _nestedOk = Assert<MatchesContract<NestedOk, GenNested>>;
// @ts-expect-error an extra field inside a nested object is drift
type _nestedExtraObject = Assert<MatchesContract<NestedExtraObject, GenNested>>;
// @ts-expect-error an extra field inside an array element is drift
type _nestedExtraElement = Assert<MatchesContract<NestedExtraElement, GenNested>>;
// @ts-expect-error a renamed nested field is drift
type _nestedRenamed = Assert<MatchesContract<NestedRenamed, GenNested>>;

describe('api-schema contract assertions', () => {
  it('are checked by the TypeScript compiler (see the type aliases above)', () => {
    expect(true).toBe(true);
  });
});
