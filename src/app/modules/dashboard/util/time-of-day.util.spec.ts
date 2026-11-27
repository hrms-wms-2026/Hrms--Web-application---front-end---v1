import { describe, expect, it } from 'vitest';
import { getTimeOfDayInfo } from './time-of-day.util';

// Local wall-clock times, so the result does not depend on the machine's timezone.
const at = (hour: number, minute = 0) => new Date(2026, 9, 23, hour, minute);

describe('getTimeOfDayInfo', () => {
  it.each([
    [5, 0, 'morning', 'Good morning', 'greeting-morning-blue'],
    [11, 59, 'morning', 'Good morning', 'greeting-morning-blue'],
    [12, 0, 'afternoon', 'Good afternoon', 'greeting-midday-blue'],
    [16, 59, 'afternoon', 'Good afternoon', 'greeting-midday-blue'],
    [17, 0, 'evening', 'Good evening', 'golden_hour_sunset_dusk'],
    [20, 59, 'evening', 'Good evening', 'golden_hour_sunset_dusk'],
    [21, 0, 'night', 'Good night', 'calm_night_sky_deep'],
    [4, 59, 'night', 'Good night', 'calm_night_sky_deep']
  ])('at %i:%i is %s with its own greeting and picture', (hour, minute, timeOfDay, greeting, picture) => {
    const info = getTimeOfDayInfo(at(hour, minute));
    expect(info.timeOfDay).toBe(timeOfDay);
    expect(info.greeting).toBe(greeting);
    expect(info.illustrationSrc).toContain(picture);
  });
});
