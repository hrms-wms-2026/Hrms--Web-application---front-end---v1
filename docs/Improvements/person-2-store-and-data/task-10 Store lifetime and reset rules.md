# Task 10: Store lifetime and reset rules

| | |
|---|---|
| Priority | 10 of 24 (lower number = build first) |
| Owner folder | person-2-store-and-data |
| Size | 1 person, 1 day |
| Area | Store |
| Depends on | nothing |

## What we found

56 of the 65 stores are `providedIn: 'root'`. A root store is created once and lives until the tab closes. Effects:

- Data from the previous screen, project or legal entity is still there when the user comes back, so stale data flashes before the reload finishes.
- Memory only grows during a long session.
- After sign-out and sign-in as another user in the same tab, any store that is not cleared by hand still holds the first user's data. Only 23 store files contain a reset or clear method.

## What to do

1. Sort every store into one of three groups and record it in a table in `docs/core/`:
   - app-wide (auth, theme, notifications, selected legal entity): stays root;
   - feature-wide (shared by several screens of one module): provided in the module's route `providers`;
   - screen-only: provided in the component.
2. Move the screen-only and feature-wide stores out of root, module by module. Start with Work, the largest.
3. Add a `withReset()` store feature and one `AppStateReset` service that resets every remaining root store on sign-out and on tenant or legal entity switch.
4. Add a test: sign out, sign in as another user, assert no root store holds old data.
5. Check stores that hold timers or realtime subscriptions clean up in `onDestroy`.

## Done when

- The table lists every store with its group.
- Work module stores are moved and their specs pass.
- The sign-out test passes.
