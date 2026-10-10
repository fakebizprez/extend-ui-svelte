// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('xlsx-viewer preview renders sheet tabs and cell values', async ({ page }) => {
	await page.goto('/xlsx-viewer');

	await expect(page.locator('h1')).toContainText('XLSX Viewer');

	const viewer = page.getByTestId('xlsx-viewer').first();
	await expect(viewer.getByRole('tab', { name: 'Inventory' })).toBeVisible();
	await expect(viewer.getByRole('tab', { name: 'Summary' })).toBeVisible();
	await expect(viewer.getByRole('tab', { name: 'Notes' })).toBeVisible();

	await expect(viewer.getByRole('columnheader', { name: 'SKU' })).toBeVisible();
	await expect(viewer.getByRole('cell', { name: 'Resistor kit' }).first()).toBeVisible();
	await expect(viewer.getByRole('cell', { name: 'Reno' }).first()).toBeVisible();
	await expect(viewer.getByTestId('row-count')).toContainText('5 rows');
});

test('xlsx-viewer switches sheets when a tab is clicked', async ({ page }) => {
	await page.goto('/xlsx-viewer');

	const viewer = page.getByTestId('xlsx-viewer').first();
	await viewer.getByRole('tab', { name: 'Summary' }).click();

	await expect(viewer.getByRole('columnheader', { name: 'Metric' })).toBeVisible();
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
