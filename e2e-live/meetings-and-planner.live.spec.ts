import { test, expect } from './live.fixture';
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

test('planner: a due task dropped on the timeline becomes a block that can grow and be removed', async ({ app: page }) => {
  await openFromNav(page, 'Planner');
  const task = page.getByTestId('planner-due-task').first();
  const title = (await task.innerText()).split('\n')[0].trim();
  // 06:00 + 16 half hours = 14:00.
  const slot = page.getByTestId('planner-slot').nth(16);

  // The planner uses native HTML5 drag and drop; one DataTransfer carries the task id from dragstart to drop, as in
  // a real browser drag (Playwright's mouse-driven dragTo does not deliver it here).
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await task.dispatchEvent('dragstart', { dataTransfer: transfer });
  await slot.dispatchEvent('dragover', { dataTransfer: transfer });
  await slot.dispatchEvent('drop', { dataTransfer: transfer });

  const block = page.getByTestId('planner-block').filter({ hasText: title });
  await expect(block).toBeVisible();
  await expect(block).toContainText('1h 0m');

  await block.getByTestId('planner-block-longer').click();
  await expect(block).toContainText('1h 15m');

  await block.getByTestId('planner-block-delete').click();
  await expect(page.getByTestId('planner-block').filter({ hasText: title })).toHaveCount(0);
});

test('meeting: created from the calendar with a group invite, opens in its drawer, edits and cancels', async ({ app: page }) => {
  const title = `E2E sync ${RUN}`;
  await openFromNav(page, 'Calendar');
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
  await openFromNav(page, 'Calendar');
  await page.getByTestId('calendar-new-meeting').click();
  await page.getByTestId('meeting-title').fill(`E2E short ${RUN}`);
  await page.locator('input[formcontrolname="date"]').fill(tomorrow());
  await page.locator('input[formcontrolname="time"]').fill('15:00');

  await page.locator('input[formcontrolname="durationMinutes"]').fill('10');
  await expect(page.getByTestId('meeting-save')).toBeDisabled();

  await page.locator('input[formcontrolname="durationMinutes"]').fill('30');
  await expect(page.getByTestId('meeting-save')).toBeEnabled();
});
