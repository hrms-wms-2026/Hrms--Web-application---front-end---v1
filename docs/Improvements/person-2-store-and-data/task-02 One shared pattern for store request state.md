# Task 02: One shared pattern for store request state

| | |
|---|---|
| Priority | 2 of 24 (lower number = build first) |
| Owner folder | person-2-store-and-data |
| Size | 1 person, 1 day |
| Area | Store |
| Depends on | nothing |

## What we found

There are 65 store files. Nearly all of them declare the same state by hand: `loading: false` appears 164 times, `saving: false` 141 times, `error: null` 141 times. Each store then repeats the same steps around every call: set loading, try, patch the data, catch, set the error, clear loading. That is 939 `patchState` calls, a large share of them this boilerplate.

Because it is written by hand each time, nothing keeps the stores the same. Check for drift such as: whether the old error is cleared before a new load, and whether old data stays visible while reloading.

## What to do

1. Write a `withRequestState()` signal store feature in `shared/state`: it adds `loading`, `saving`, `error`, `loaded` and helper methods `runLoad(fn)` and `runSave(fn)`.
2. Decide the rules once and put them in the helper: clear the error at the start, keep old data while reloading, map the backend problem body to one error shape.
3. Write unit tests for the helper.
4. Move three stores of different kinds to it as the reference (one list store, one detail store, one store with saves).
5. Write a short guide in `docs/core/` with a before and after example.
6. List the remaining stores in a table with an owner so the move can continue module by module.

## Done when

- The helper exists with tests and three stores use it.
- The guide is merged.
- The moved stores have less code and their specs still pass.
