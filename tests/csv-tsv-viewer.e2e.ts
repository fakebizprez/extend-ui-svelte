// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';

async function openPage(page: Page) {
	await page.goto('/csv-tsv-viewer');
	await expect(page.locator('h1')).toContainText('CSV/TSV Viewer');
	const csv = page.getByTestId('csv-tsv-viewer').nth(0);
	const tsv = page.getByTestId('csv-tsv-viewer').nth(1);
	// Ready once parsing finished and the search trigger is enabled (hydrated).
	await expect(csv.getByRole('cell', { name: 'INV-1001' })).toBeVisible();
	await expect(csv.getByRole('button', { name: 'Search CSV' })).toBeEnabled();
	return { csv, tsv };
}

test('csv-tsv-viewer renders the CSV and TSV fixtures', async ({ page }) => {
	const { csv, tsv } = await openPage(page);

	await expect(csv.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
	await expect(csv.getByRole('cell', { name: 'Northstar Supply' })).toBeVisible();
	await expect(csv.getByTestId('row-count')).toHaveText('10 rows');

	await expect(tsv.getByRole('columnheader', { name: 'Warehouse' })).toBeVisible();
	await expect(tsv.getByRole('cell', { name: 'Resistor kit' })).toBeVisible();
	await expect(tsv.getByTestId('row-count')).toHaveText('4 rows');
});

test('csv-tsv-viewer search highlights matches and steps through them', async ({ page }) => {
	const { csv } = await openPage(page);

	await csv.getByRole('button', { name: 'Search CSV' }).click();
	const panel = csv.getByRole('dialog', { name: 'Search CSV' });
	const input = panel.getByRole('searchbox', { name: 'Search CSV' });
	await expect(input).toBeFocused();
	await page.keyboard.type('needs review');

	const label = csv.getByTestId('search-result-label');
	await expect(label).toHaveText('1 / 2');
	await expect(csv.getByTestId('search-result-address')).toHaveText('Status!C2');
	// Every row stays visible; like upstream only the active match is selected.
	await expect(csv.locator('tbody tr[data-row-index]')).toHaveCount(10);
	const active = csv.locator('td[data-search-active]');
	await expect(active).toHaveCount(1);
	await expect(active).toHaveText('Needs review');
	await expect(active.locator('xpath=..')).toHaveAttribute('data-row-index', '1');

	await panel.getByRole('button', { name: 'Next result' }).click();
	await expect(label).toHaveText('2 / 2');
	await expect(csv.getByTestId('search-result-address')).toHaveText('Status!C8');
	await expect(active.locator('xpath=..')).toHaveAttribute('data-row-index', '7');

	await page.keyboard.press('Shift+Enter');
	await expect(label).toHaveText('1 / 2');
	await page.keyboard.press('Enter');
	await expect(label).toHaveText('2 / 2');

	await panel.getByRole('button', { name: 'Clear' }).click();
	await expect(label).toHaveText('No search');
	await expect(active).toHaveCount(0);
});

test('csv-tsv-viewer find popover closes on an outside click', async ({ page }) => {
	const { csv } = await openPage(page);
	const trigger = csv.getByRole('button', { name: 'Search CSV' });
	await trigger.click();
	const panel = csv.getByRole('dialog', { name: 'Search CSV' });
	await page.keyboard.type('approved');
	await expect(csv.getByTestId('search-result-label')).toHaveText('1 / 5');

	// Clicks inside keep it open.
	await panel.getByRole('button', { name: 'Next result' }).click();
	await expect(panel).toBeVisible();

	await page.locator('h1').click();
	await expect(panel).toHaveCount(0);
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	// The active match stays selected, as upstream's grid selection does.
	await expect(csv.locator('td[data-search-active]')).toHaveCount(1);
});

test('csv-tsv-viewer search scrolls the active match into view', async ({ page }) => {
	await openPage(page);
	const long = page.getByTestId('csv-tsv-viewer').nth(2);
	await expect(long.getByTestId('row-count')).toHaveText('2000 rows');
	await expect(long.getByRole('cell', { name: 'L-1500', exact: true })).toHaveCount(0);

	await long.getByRole('button', { name: 'Search CSV' }).click();
	await page.keyboard.type('L-1500');
	await expect(long.getByTestId('search-result-label')).toHaveText('1 / 1');
	await expect(long.getByTestId('search-result-address')).toHaveText('Load!A1500');

	const active = long.locator('td[data-search-active]');
	await expect(active).toHaveText('L-1500');
	const viewport = long.getByTestId('csv-viewport');
	expect(await viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(1400 * 34);
	const [cellBox, viewportBox] = await Promise.all([active.boundingBox(), viewport.boundingBox()]);
	expect(cellBox!.y).toBeGreaterThanOrEqual(viewportBox!.y);
	expect(cellBox!.y + cellBox!.height).toBeLessThanOrEqual(viewportBox!.y + viewportBox!.height);
	// Still windowed: far-away rows are not rendered.
	await expect(long.getByRole('cell', { name: 'L-1', exact: true })).toHaveCount(0);
});

test('csv-tsv-viewer dark mode follows the parent', async ({ page }) => {
	const { csv, tsv } = await openPage(page);

	await expect(csv).toHaveAttribute('data-dark', 'false');
	await expect(tsv).toHaveAttribute('data-dark', 'true');
	// No theme control inside the viewer, like upstream.
	await expect(csv.getByRole('switch')).toHaveCount(0);

	const lightBg = await csv.evaluate((el) => getComputedStyle(el).backgroundColor);
	await page.getByTestId('page-dark-toggle').click();
	await expect(csv).toHaveAttribute('data-dark', 'true');
	await expect(csv).toHaveClass(/\bdark\b/);
	const darkBg = await csv.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(darkBg).not.toBe(lightBg);
});
