import { test, expect, TENANT } from './live.fixture';
import type { Page } from '@playwright/test';

/**
 * Live journeys for meetings-as-tasks and the day planner, against the local API with the Meetings and Planner flags
 * on (see playwright.live.config.ts). Each run creates its own uniquely named data and cleans up what it can: the
 * planned block is removed and the meeting ends cancelled.
 */

const RUN = Date.now().toString(36);

async function openFromNav(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name, exact: true }).first().click();
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The hour-grid column of `date`, scrolled so `minute` is on screen, and the screen point of that minute in it. */
async function pointIn(page: Page, date: string, minute: number): Promise<{ x: number; y: number }> {
  const column = page.locator(`[data-testid="calendar-hour-day-column"][data-date="${date}"]`);
  await column.evaluate((el, m) => {
    const scroller = el.parentElement!;
    scroller.scrollTop = (m / 1440) * el.scrollHeight - 80;
  }, minute);
  const box = (await column.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + (minute / 1440) * box.height + 2 };
}

/** Planner = Calendar: the Week view with all seven days, showing tomorrow. */
async function openPlannerWeek(page: Page): Promise<string> {
  await openFromNav(page, 'Planner');
  await page.getByTestId('calendar-view-week').click();
  const weekend = page.getByTestId('planner-show-weekend');
  if ((await weekend.innerText()).includes('Show')) await weekend.click();
  const date = tomorrow();
  if (await page.locator(`[data-testid="calendar-hour-day-column"][data-date="${date}"]`).count() === 0) {
    await page.getByRole('button', { name: '›' }).click();
  }
  await expect(page.locator(`[data-testid="calendar-hour-day-column"][data-date="${date}"]`)).toBeVisible();
  return date;
}

test('planner: a Focus task dragged onto tomorrow becomes a block that can grow, clash with a meeting, move after it and go', async ({ app: page }) => {
  const date = await openPlannerWeek(page);
  const card = page.getByTestId('planner-focus-card').first();
  const title = (await card.locator('button').first().innerText()).trim();

  // Drag the card onto tomorrow 10:00 (pointer events, as a mouse does).
  const from = (await card.boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + 10);
  await page.mouse.down();
  const to = await pointIn(page, date, 600);
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();

  const column = page.locator(`[data-testid="calendar-hour-day-column"][data-date="${date}"]`);
  const block = column.getByTestId('planner-block').filter({ hasText: title });
  await expect(block).toBeVisible();
  await expect(block).toContainText('10:00–');

  // Make it 30 minutes longer by its bottom edge.
  const before = (await block.boundingBox())!.height;
  const edge = (await block.getByTestId('planner-block-resize').boundingBox())!;
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
  await page.mouse.down();
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2 + (30 / 1440) * (await column.boundingBox())!.height, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await block.boundingBox())!.height).toBeGreaterThan(before + 10);

  // A meeting at 10:15 clashes with it; "Move after" clears the clash.
  const meetingTitle = `E2E clash ${RUN}`;
  await page.getByTestId('calendar-new-meeting').click();
  await page.getByTestId('meeting-project').selectOption({ label: 'The Hardware integration portal' });
  const module = page.getByTestId('meeting-module');
  await expect(module.locator('option')).not.toHaveCount(1);
  await module.selectOption({ index: 1 });
  await page.getByTestId('meeting-title').fill(meetingTitle);
  await page.locator('input[formcontrolname="date"]').fill(date);
  await page.locator('input[formcontrolname="time"]').fill('10:15');
  await page.locator('input[formcontrolname="durationMinutes"]').fill('30');
  await page.getByTestId('meeting-save').click();
  await expect(page.getByTestId('meeting-drawer-title')).toHaveText(meetingTitle);
  await page.keyboard.press('Escape');

  await expect(block.getByTestId('planner-overlap-pill')).toContainText(`Overlaps ${meetingTitle} · Move after`);
  await block.getByTestId('planner-overlap-pill').click();
  await expect(column.getByTestId('planner-overlap')).toHaveCount(0);
  await expect(block).not.toContainText('10:00–');

  // Clean up: remove the block, cancel the meeting.
  await block.getByTestId('planner-block-menu').click();
  await column.getByTestId('planner-menu-remove').click();
  await expect(column.getByTestId('planner-block').filter({ hasText: title })).toHaveCount(0);
  await column.getByTestId('calendar-hour-event-block').filter({ hasText: meetingTitle }).click();
  await page.getByTestId('meeting-cancel').click();
  await expect(page.getByTestId('meeting-status-pill')).toHaveText('Cancelled');
});

test('nav: the calendar item reads Planner, and old /calendar links still open it', async ({ app: page }) => {
  await expect(page.getByRole('link', { name: 'Planner', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Calendar', exact: true })).toHaveCount(0);

  await page.goto(`${TENANT}/calendar`);
  await expect(page.getByTestId('calendar-view-week')).toBeVisible();
  await expect(page.getByTestId('planner-focus-toggle')).toBeVisible();
});

test('meeting: created from the calendar with a group invite, opens in its drawer, edits and cancels', async ({ app: page }) => {
  const title = `E2E sync ${RUN}`;
  await openFromNav(page, 'Planner');
  await page.getByTestId('calendar-new-meeting').click();

  await page.getByTestId('meeting-project').selectOption({ label: 'The Hardware integration portal' });
  const module = page.getByTestId('meeting-module');
  await expect(module.locator('option')).not.toHaveCount(1);
  await module.selectOption({ index: 1 });
  await page.getByTestId('meeting-title').fill(title);
  await page.locator('input[formcontrolname="date"]').fill(tomorrow());
  await page.locator('input[formcontrolname="time"]').fill('15:00');
  await page.locator('input[formcontrolname="durationMinutes"]').fill('30');

  // The group invite: nothing picked yet, so Preview says what to pick; then a department is previewed and added.
  await expect(page.getByTestId('bulk-preview')).toBeDisabled();
  await expect(page.getByTestId('bulk-preview-hint')).toBeVisible();
  await page.getByLabel('Marketing', { exact: true }).check();
  await page.getByTestId('bulk-preview').click();
  await expect(page.getByTestId('bulk-counts')).toContainText('Selected');
  await page.getByTestId('bulk-add').click();

  await page.getByTestId('meeting-save').click();

  // A created meeting opens in its drawer.
  await expect(page.getByTestId('meeting-drawer-title')).toHaveText(title);
  await expect(page.getByTestId('meeting-status-pill')).toHaveText('Scheduled');

  await page.getByTestId('meeting-edit').click();
  await page.getByTestId('meeting-title').fill(`${title} (moved room)`);
  await page.getByTestId('meeting-save').click();
  await expect(page.getByTestId('meeting-drawer-title')).toHaveText(`${title} (moved room)`);

  await page.getByTestId('meeting-cancel').click();
  await expect(page.getByTestId('meeting-status-pill')).toHaveText('Cancelled');
});

test('meeting form: a duration under 15 minutes cannot be saved', async ({ app: page }) => {
  await openFromNav(page, 'Planner');
  await page.getByTestId('calendar-new-meeting').click();
  await page.getByTestId('meeting-title').fill(`E2E short ${RUN}`);
  await page.locator('input[formcontrolname="date"]').fill(tomorrow());
  await page.locator('input[formcontrolname="time"]').fill('15:00');

  await page.locator('input[formcontrolname="durationMinutes"]').fill('10');
  await expect(page.getByTestId('meeting-save')).toBeDisabled();

  await page.locator('input[formcontrolname="durationMinutes"]').fill('30');
  await expect(page.getByTestId('meeting-save')).toBeEnabled();
});
