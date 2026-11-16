# Task 14: Cancel stale requests and update lists without full reloads

| | |
|---|---|
| Priority | 14 of 24 (lower number = build first) |
| Owner folder | person-2-store-and-data |
| Size | 1 person, 1 day |
| Area | Store, Performance |
| Depends on | 02 |

## What we found

Stores call the API with `firstValueFrom` 315 times and use `rxMethod` only 3 times. `firstValueFrom` cannot cancel. Two results follow:

- When a user types in a filter or switches a tab quickly, several requests run and the slowest one wins, even if it is the oldest. The screen can show results for the wrong filter.
- Requests keep running after the user has left the screen.

Separately, check each store's save methods: where a save is followed by reloading the whole list, the user waits for two requests and the backend does the work twice.

## What to do

1. In the request helper from task 02 add a "latest wins" mode: each new load cancels or ignores the previous one (`rxMethod` with `switchMap`, or a request counter).
2. Apply it to every store method that is triggered by typing, filter changes, tab switches or route parameter changes. Start with task board, backlog, employee list and inbox.
3. Tie requests to the store lifetime so they stop when the store is destroyed.
4. For saves: update the changed item in the store from the save response. Reload the list only when the change can affect sorting, counts or other rows, and say why in a comment.
5. For drag and drop moves, update the store first and roll back on error.
6. Add specs for the race: slow first response, fast second response, assert the second one stays.

## Done when

- Fast typing in the four screens never shows results for an older filter.
- The network tab shows cancelled requests when filters change quickly.
- Saves on those screens make one request, not two.
