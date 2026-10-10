// MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('parses CSV and TSV samples into tables', async ({ page }) => {
	await page.goto('/csv-tsv-viewer', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	const [csv, tsv, empty] = await page.getByTestId('csv-tsv-viewer').all();
	await expect(csv.getByTestId('row-count')).toHaveText('10 rows');
	await expect(csv.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
	await expect(csv.getByRole('cell', { name: 'Northstar Supply' })).toBeVisible();

	await expect(tsv.getByTestId('row-count')).toHaveText('4 rows');
	await expect(tsv.getByRole('columnheader', { name: 'Warehouse' })).toBeVisible();

	await expect(empty).toContainText('No data to preview');
});

test('search filters rows and reports no matches', async ({ page }) => {
	await page.goto('/csv-tsv-viewer', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	const csv = page.getByTestId('csv-tsv-viewer').first();
	const search = csv.getByRole('searchbox', { name: 'Search table' });

	await search.fill('Needs review');
	await expect(csv.getByTestId('row-count')).toHaveText('2 of 10 rows');
	await expect(csv.locator('tr[data-row-index]')).toHaveCount(2);

	await search.fill('zzz-no-match');
	await expect(csv).toContainText('No rows match the current search.');
});

test('dark mode toggle round-trips through the parent', async ({ page }) => {
	await page.goto('/csv-tsv-viewer', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	const csv = page.getByTestId('csv-tsv-viewer').first();
	await expect(csv).toHaveAttribute('data-dark', 'false');
	await csv.getByRole('switch', { name: 'Toggle dark mode' }).click();
	await expect(csv).toHaveAttribute('data-dark', 'true');
});
