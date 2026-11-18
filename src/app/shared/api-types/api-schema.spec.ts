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

describe('api-schema contract assertions', () => {
  it('are checked by the TypeScript compiler (see the type aliases above)', () => {
    expect(true).toBe(true);
  });
});
