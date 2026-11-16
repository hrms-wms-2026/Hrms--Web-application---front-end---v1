# Task 22: Stable list tracking and cheaper computed state

| | |
|---|---|
| Priority | 22 of 24 (lower number = build first) |
| Owner folder | person-2-store-and-data |
| Size | 1 person, 1 day |
| Area | Performance, Store |
| Depends on | nothing |

## What we found

- 37 `@for` blocks use `track $index`. When an item is added, removed or the list is re-sorted, Angular then reuses DOM nodes for different items: more re-rendering, lost focus or scroll position, and animation glitches.
- The code has 1,239 `computed` signals and 186 `effect` calls. Most are fine. The risk is in the few that do heavy work: sorting, grouping or filtering a large array inside a `computed` that is re-run on unrelated changes, and effects that write to other signals (which can cascade).

## What to do

1. Replace `track $index` with a stable id wherever the items have one. Keep `$index` only for truly static lists and say so in a comment.
2. Find the expensive `computed`s: start with task board, backlog, tree view, planner, employee list and dashboard cards. Look for `.sort(`, `.filter(`, `.reduce(`, `new Map(` on full lists.
3. For each: split it so the heavy part depends only on the data it needs, not on unrelated state like the hovered item or an open menu.
4. Give signals that hold objects or arrays an equality function where the same content is often set again.
5. Review effects that set signals. Replace with `computed` or `linkedSignal` where the value is derived. Keep effects for real side effects only.
6. Use the Angular DevTools profiler to confirm each change.

## Done when

- `track $index` remains only where justified.
- The profiler shows fewer and shorter change detection runs on the task board when hovering and opening menus.
- A short note of what was changed and why is added to `docs/core/`.
