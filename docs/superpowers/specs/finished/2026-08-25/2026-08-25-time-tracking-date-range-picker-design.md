# Time Tracking Date-Range Picker Design

**Goal:** Replace the Time Tracking page's two separate From/To `app-date-picker` inputs plus an "Apply" button with a single icon-triggered calendar control that selects a date range in one popover.

**Scope:** A new shared component, `app-date-range-picker`, used only by the Time Tracking page's two range controls ("My attendance history" and "Team attendance"). The existing single-date `app-date-picker` (used by the employee wizard, dependents panel, and personal-info form) is untouched.

## Component: `DateRangePickerComponent`

Location: `src/app/shared/ui/date-range-picker/` (selector `app-date-range-picker`), modeled on the existing `DatePickerComponent`'s calendar-grid rendering (`CalendarDay`, month navigation, day-of-week header) and its "Apple-style" popover CSS (same design tokens, rounded day buttons, fade-in animation) — but adapted for range selection instead of single-date.

**Public API:**
- `from = input<string>('')`, `to = input<string>('')` — current range, `YYYY-MM-DD`.
- `disabled = input(false)`.
- `rangeChange = output<{ from: string; to: string }>()` — emitted once, only when a complete range has been picked.

**Closed (trigger) state:** a single button showing a calendar icon plus the applied range as text, e.g. `📅 Aug 17 – Aug 23` (icon-only only in the on-the-fence case where `from`/`to` are both empty, which doesn't occur on the Time Tracking page since it always has a default range).

**Open (popover) state:** one month-grid calendar (no two-month side-by-side view). Internal selection state machine:
- No in-progress pick yet → clicking a day sets it as the **pending start**; that day is highlighted.
- Pending start exists → hovering later days shows an "in-range" tint between start and hover; clicking a day sets it as the **end** (if the clicked day is before the pending start, start/end swap so `from <= to`), emits `rangeChange` with the finished range, and closes the popover.
- A day clicked while a *complete* range is already showing starts a new pick from that day (not an extension).

Footer keeps the existing "Today" shortcut, which sets a same-day range (`from == to == today`) and applies immediately.

**Not included:** free-text date entry (calendar-only, no typed input), so there's no invalid-range state to surface — the two-click flow guarantees `from <= to` by construction.

## Time Tracking Page Integration

`time-tracking.component.html`: both range-control blocks (My history and Team attendance) replace their `<app-date-picker label="From">` + `<app-date-picker label="To">` + `<app-button>Apply</app-button>` trio with a single:

```html
<app-date-range-picker
  [from]="historyFrom()"
  [to]="historyTo()"
  [disabled]="store.historyLoading()"  <!-- or store.coveredHistoryLoading() for the team block -->
  (rangeChange)="onRangeSelected($event)"
/>
```

`time-tracking.component.ts`: removed — `rangeError` signal, `setHistoryFrom`/`setHistoryTo`/`selectedRange()` methods (no longer needed since the picker enforces valid ranges and there's no free-text path). Added — a single `onRangeSelected(range: TimeTrackingRange): void` that sets `historyFrom`/`historyTo` and calls the same loader logic `applyHistoryRange()` already routes through (respecting the current MY/TEAM `viewMode`), then resets both views' pages to 1 via the existing `loadMyHistory`/`loadCoveredHistory` default `page = 1` parameter. `historyFrom`/`historyTo` signals stay (still needed to seed the picker's `[from]`/`[to]` inputs and as the source of truth `ngOnInit` and `selectViewMode` read from).

## Testing

- New `date-range-picker.component.spec.ts` mirroring `date-picker.component.spec.ts`'s structure: calendar rendering, two-click range selection (including the before-start swap case), the third-click-restarts-a-new-range case, `rangeChange` emission shape, the Today shortcut, and closed-state label text.
- `time-tracking.component.spec.ts`: the range-control assertions that reference `app-date-picker`/Apply-button markup are replaced with assertions against the new single control; the `rangeError` test is removed since that state no longer exists.
