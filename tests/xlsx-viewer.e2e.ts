// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('xlsx-viewer preview renders sheet tabs and cell values', async ({ page }) => {
	await page.goto('/xlsx-viewer');

	await expect(page.locator('h1')).toContainText('XLSX Viewer');

	const viewer = page.getByTestId('xlsx-viewer').first();
	await expect(viewer.getByRole('tab', { name: 'Inventory' })).toBeVisible();
	await expect(viewer.getByRole('tab', { name: 'Summary' })).toBeVisible();
	await expect(viewer.getByRole('tab', { name: 'Notes' })).toBeVisible();

	// Like upstream: column letters and row numbers, with row 1 as data.
	await expect(viewer.getByRole('columnheader', { name: 'A', exact: true })).toBeVisible();
	await expect(viewer.getByRole('columnheader', { name: 'D', exact: true })).toBeVisible();
	await expect(viewer.getByRole('columnheader', { name: 'SKU' })).toHaveCount(0);
	const firstRow = viewer.locator('[data-row-index="0"]');
	await expect(firstRow.getByRole('rowheader')).toHaveText('1');
	await expect(firstRow.getByRole('cell').first()).toHaveText('SKU');
	await expect(viewer.getByRole('cell', { name: 'Resistor kit' }).first()).toBeVisible();
	await expect(viewer.getByRole('cell', { name: 'Reno' }).first()).toBeVisible();
	await expect(viewer.getByTestId('row-count')).toHaveText('6 rows');
});

test('xlsx-viewer keeps true positions and matches the editor row count', async ({ page }) => {
	await page.goto('/xlsx-viewer');
	const viewer = page.getByTestId('xlsx-viewer').first();
	await viewer.getByRole('tab', { name: 'Lanes' }).click();

	// Lanes data starts at B2 with a blank row 4.
	await expect(viewer.getByRole('cell', { name: 'Lane', exact: true })).toBeVisible();
	await expect(viewer.getByTestId('row-count')).toHaveText('6 rows');
	const row = (index: number) => viewer.locator(`[data-row-index="${index}"]`).getByRole('cell');
	await expect(row(0)).toHaveText(['', '', '', '']);
	await expect(row(1)).toHaveText(['', 'Lane', 'Loads', 'Miles']);
	await expect(row(3)).toHaveText(['', '', '', '']);
	await expect(row(5)).toHaveText(['', 'Total', '7', '3300']);

	await page.goto('/xlsx-editor');
	const editor = page.getByTestId('xlsx-editor').first();
	await editor.getByRole('tab', { name: 'Lanes' }).click();
	await expect(editor.getByRole('gridcell', { name: 'Lane', exact: true })).toBeVisible();
	await expect(editor.getByTestId('row-count')).toHaveText('6 rows');
});

test('xlsx-viewer switches sheets when a tab is clicked', async ({ page }) => {
	await page.goto('/xlsx-viewer');

	const viewer = page.getByTestId('xlsx-viewer').first();
	await viewer.getByRole('tab', { name: 'Summary' }).click();

	await expect(viewer.getByRole('cell', { name: 'Metric' })).toBeVisible();
	await expect(viewer.getByRole('cell', { name: 'Total SKUs' })).toBeVisible();
	await expect(viewer.getByRole('cell', { name: '787' })).toBeVisible();
	await expect(viewer.getByRole('cell', { name: 'Resistor kit' })).not.toBeVisible();
});

test('xlsx-viewer dark-mode toggle notifies the parent', async ({ page }) => {
	await page.goto('/xlsx-viewer');

	const viewer = page.getByTestId('xlsx-viewer').first();
	await expect(viewer.getByRole('tab', { name: 'Inventory' })).toBeVisible();
	await expect(viewer).toHaveAttribute('data-dark', 'false');

	await viewer.getByRole('switch', { name: 'Toggle dark mode' }).click();

	await expect(viewer).toHaveAttribute('data-dark', 'true');
});
