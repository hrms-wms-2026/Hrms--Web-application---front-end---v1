# Task 19: Bundle size and first load

| | |
|---|---|
| Priority | 19 of 24 (lower number = build first) |
| Owner folder | person-3-performance-and-rendering |
| Size | 1 person, 1 day |
| Area | Performance |
| Depends on | 01 |

## What we found

- The initial bundle budget is a warning at 500 kB and an error at 1 MB. An error limit twice the warning lets the bundle grow a long way before anyone must act.
- Earlier work measured the home route at 390 kB compressed and cut it to 173 kB with a lazy widget registry and deferred modals. Check that work is merged; if it is still local, it should be finished first.
- 52 lazy components and 9 lazy route groups exist, and only 8 `@defer` blocks.
- The public landing page has very large templates (`landing-hero.component.html`, 1,108 lines) and loads for every anonymous visitor.

## What to do

1. Build with `--stats-json` and open the result in a bundle analyser. Save the report.
2. List everything above 20 kB in the initial bundle and decide for each: needed at start, or lazy.
3. Usual gains: the rich text editor, emoji picker, charts, SignalR client, DOMPurify and date libraries load only where used.
4. Make sure the landing page does not pull app code, and the app does not pull landing code.
5. Check images in `public/`: right size, modern format, `loading="lazy"` below the fold, width and height set.
6. Preload only the fonts used on first paint.
7. Tighten the budget to the measured size plus 10 percent, warning and error close together. CI from task 01 enforces it.

## Done when

- The analyser report before and after is saved in `docs/reports/`.
- The initial bundle for the signed-in home route is at or under the agreed number.
- The budget in `angular.json` matches reality.
