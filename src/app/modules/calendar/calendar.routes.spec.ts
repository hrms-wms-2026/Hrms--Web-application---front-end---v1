import { CALENDAR_ROUTES } from './calendar.routes';

describe('CALENDAR_ROUTES', () => {
  it('registers a single root route', () => {
    expect(CALENDAR_ROUTES.length).toBe(1);
    expect(CALENDAR_ROUTES[0].path).toBe('');
  });

  // Imports the whole Planner page, which can take over the default 5s while the other spec files run alongside it.
  it('lazy-loads CalendarPageComponent', async () => {
    const loaded = await (CALENDAR_ROUTES[0].loadComponent as () => Promise<unknown>)();
    expect(loaded).toBeDefined();
  }, 30_000);
});
