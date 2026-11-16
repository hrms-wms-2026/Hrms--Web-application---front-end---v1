# Task 07: Virtual scrolling for long lists

| | |
|---|---|
| Priority | 7 of 24 (lower number = build first) |
| Owner folder | person-3-performance-and-rendering |
| Size | 1 person, 1 day |
| Area | Performance, Rendering |
| Depends on | nothing |

## What we found

No list in the app uses virtual scrolling. Every row is rendered as real DOM, even when thousands are off screen. The heaviest places:

- task board columns (`task-board-column.component.ts`, 1,542 lines) with drag and drop;
- task backlog (`task-backlog.component.ts`, 942 lines);
- employee lists and the people network explorer;
- inbox conversation list and message list;
- planner and team schedule rows.

Pagination (task 03) solves this for tables. Boards, chat and schedules cannot be paged in the same way, so they need windowing.

## What to do

1. Add CDK virtual scroll to the task board column first. Check drag and drop still works; the CDK supports both together but item size must be known or estimated.
2. Do the inbox message list next, with "load older" on scroll to the top.
3. For lists with rows of different heights use a fixed estimated size and test scroll jump.
4. Keep keyboard navigation and screen reader behaviour: focused items must not vanish while focused.
5. Check `@for` blocks in these lists use a stable id in `track`. 37 places use `track $index`, which forces re-render when the list changes.
6. Measure with the browser performance panel on a column of 500 cards before and after.

## Done when

- A board column with 500 cards scrolls smoothly and renders about 30 card elements.
- Drag and drop between columns still works and its tests pass.
- Before and after numbers are saved in `docs/reports/`.
