# Task 15: Split the largest components

| | |
|---|---|
| Priority | 15 of 24 (lower number = build first) |
| Owner folder | person-3-performance-and-rendering |
| Size | 1 person, 1 day |
| Area | Architecture, Code quality |
| Depends on | nothing |

## What we found

A few files do far too much:

| File | Lines |
|---|---|
| `modules/work/ui/task-form-modal/task-form-modal.component.ts` | 3,770 |
| `shared/ui/rich-text-editor/rich-text-editor.component.ts` | 2,746 |
| `modules/work/ui/task-board-column/task-board-column.component.ts` | 1,542 |
| `modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts` | 1,347 |
| `modules/people/state/add-employee-wizard.store.ts` | 1,151 |
| `modules/organization/feature/position-management/position-management.component.ts` | 1,136 |
| `modules/inbox/ui/conversation-panel/conversation-panel.component.ts` | 1,091 |

Files this size are slow to change, hard to test, cause merge conflicts and re-render as one block. Several use inline templates, which hides their real size.

## What to do

1. Take `task-form-modal` in this task. It is the largest and the Work module changes most often.
2. Draw its parts first: header, fields section, assignee and people pickers, time tracking, attachments, comments and history, footer actions.
3. Move each part into its own `OnPush` child component with signal inputs and outputs. Move form state and save logic into a store or a form service provided by the modal.
4. Use `@defer` for the heavy parts that are not visible at once (history, comments, attachments).
5. Keep behaviour identical. Run the existing specs after each extraction; add a spec to each new child.
6. Write a split plan (parts and order) for the other six files as follow-up tasks.

## Done when

- `task-form-modal.component.ts` is under 600 lines and no child is above 500.
- All existing specs pass and the modal behaves the same in a manual check.
- The split plans for the other files are saved in `docs/plans/next/`.
