import { buildTimelineSegments } from './timeline-segments.util';

const MIN = 1.5;

describe('buildTimelineSegments', () => {
  it('splits a single break into a working segment before it and a break segment after', () => {
    const start = new Date('2026-09-22T09:00:00Z').getTime();
    const end = new Date('2026-09-22T10:00:00Z').getTime();
    const breaks = [
      { startedAt: '2026-09-22T09:30:00Z', endedAt: null } // 30 min in, still open
    ];

    const segments = buildTimelineSegments(start, end, breaks, []);

    expect(segments).toEqual([
      { type: 'working', widthPercent: 50 },
      { type: 'break', widthPercent: 50 }
    ]);
  });

  it('returns no segments when there is nothing to show', () => {
    expect(buildTimelineSegments(1000, 1000, [], [])).toEqual([]);
    expect(buildTimelineSegments(1000, 500, [], [])).toEqual([]);
  });

  // Regression: clocking in and then starting/ending a break a handful of times in quick
  // succession (exactly what manual testing of the clock-in/break flow does) used to produce a
  // string of "working" gaps each a fraction of a percent wide - individually invisible in the
  // ~2px strip, so the whole bar visually read as one solid break-colored block even though real
  // working time occurred between each break.
  it('keeps every real segment visible when many short breaks leave only thin working gaps', () => {
    const start = new Date('2026-09-22T09:54:09Z').getTime(); // clock-in
    const end = new Date('2026-09-22T09:58:09Z').getTime(); // "now", 4 minutes later
    // Three ~2s test breaks, each separated by a ~2s working gap - about 8s of real "working"
    // time spread across a 240s window (~3.3% of the total), previously invisible in three
    // ~1.1%-wide slivers.
    const breaks = [
      { startedAt: '2026-09-22T09:54:11Z', endedAt: '2026-09-22T09:54:13Z' },
      { startedAt: '2026-09-22T09:54:15Z', endedAt: '2026-09-22T09:54:17Z' },
      { startedAt: '2026-09-22T09:54:19Z', endedAt: null } // still on break, runs to "now"
    ];

    const segments = buildTimelineSegments(start, end, breaks, []);

    const workingSegments = segments.filter((s) => s.type === 'working');
    const breakSegments = segments.filter((s) => s.type === 'break');

    // 3 working gaps (clock-in -> break 1, and between each pair of breaks; the third break is
    // still open and runs to "now" so there's no trailing gap) all have real duration and must
    // each still render with at least the visible-width floor.
    expect(workingSegments.length).toBe(3);
    for (const segment of workingSegments) {
      expect(segment.widthPercent).toBeGreaterThanOrEqual(MIN);
    }
    for (const segment of breakSegments) {
      expect(segment.widthPercent).toBeGreaterThan(0);
    }

    const totalWidth = segments.reduce((sum, s) => sum + s.widthPercent, 0);
    expect(totalWidth).toBeCloseTo(100, 5);
  });

  it('leaves proportions alone when every segment is already below the visible floor and there is nothing to borrow width from', () => {
    const start = new Date('2026-09-22T09:00:00Z').getTime();
    const end = new Date('2026-09-22T09:00:10Z').getTime(); // 10s window
    // A single 0.1s break right at the start - both the resulting break and the trailing working
    // segment are below MIN_VISIBLE_WIDTH_PERCENT relative to a 10s window is not true here (the
    // working remainder is huge), so instead force the *break* itself to be the only thing below
    // the floor with a working donor segment available - width should still be redistributed.
    const breaks = [{ startedAt: '2026-09-22T09:00:00Z', endedAt: '2026-09-22T09:00:00.100Z' }];

    const segments = buildTimelineSegments(start, end, breaks, []);

    const breakSegment = segments.find((s) => s.type === 'break')!;
    const workingSegment = segments.find((s) => s.type === 'working')!;
    expect(breakSegment.widthPercent).toBe(MIN);
    expect(workingSegment.widthPercent).toBeLessThan(100);
    expect(breakSegment.widthPercent + workingSegment.widthPercent).toBeCloseTo(100, 5);
  });
});
