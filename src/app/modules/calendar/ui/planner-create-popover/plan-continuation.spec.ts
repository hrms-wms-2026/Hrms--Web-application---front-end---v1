import { PlanDay, freeGaps, placeMinutes } from './plan-continuation';

describe('plan continuation', () => {
  const window = { start: 540, end: 1080 };
  const day = (date: string, busy: PlanDay['busy'] = []): PlanDay => ({ date, window, busy });

  it('an empty day is one gap', () => {
    expect(freeGaps(day('2026-11-09'))).toEqual([window]);
  });

  it('skips what is taken, and gaps too short for a block', () => {
    const gaps = freeGaps(day('2026-11-09', [{ start: 600, end: 700 }, { start: 710, end: 800 }, { start: 1000, end: 1200 }]));

    expect(gaps).toEqual([{ start: 540, end: 600 }, { start: 800, end: 1000 }]);
  });

  it('starts the rest at the start of the next working day', () => {
    expect(placeMinutes([day('2026-11-09')], 210)).toEqual({
      parts: [{ date: '2026-11-09', startMinutes: 540, endMinutes: 750 }], unplaced: 0,
    });
  });

  it('works around a planned block, then runs into the next day', () => {
    const full = { start: 600, end: 1080 };

    expect(placeMinutes([day('2026-11-09', [full]), day('2026-11-10')], 120)).toEqual({
      parts: [
        { date: '2026-11-09', startMinutes: 540, endMinutes: 600 },
        { date: '2026-11-10', startMinutes: 540, endMinutes: 600 },
      ],
      unplaced: 0,
    });
  });

  it('says how much did not fit', () => {
    expect(placeMinutes([day('2026-11-09')], 600).unplaced).toBe(60);
  });

  it('rounds a last sliver up to the shortest block', () => {
    expect(placeMinutes([day('2026-11-09')], 5).parts).toEqual([{ date: '2026-11-09', startMinutes: 540, endMinutes: 555 }]);
  });
});
