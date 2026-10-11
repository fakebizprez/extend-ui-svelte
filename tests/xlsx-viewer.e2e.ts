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
	await expect(firstRow.getByRole('gridcell').first()).toHaveText('SKU');
	await expect(viewer.getByRole('gridcell', { name: 'Resistor kit' }).first()).toBeVisible();
	await expect(viewer.getByRole('gridcell', { name: 'Reno' }).first()).toBeVisible();
	await expect(viewer.getByTestId('row-count')).toHaveText('6 rows');
});

test('xlsx-viewer keeps true positions and matches the editor row count', async ({ page }) => {
	await page.goto('/xlsx-viewer');
	const viewer = page.getByTestId('xlsx-viewer').first();
	await viewer.getByRole('tab', { name: 'Lanes' }).click();

	// Lanes data starts at B2 with a blank row 4.
	await expect(viewer.getByRole('gridcell', { name: 'Lane', exact: true })).toBeVisible();
	await expect(viewer.getByTestId('row-count')).toHaveText('6 rows');
	const row = (index: number) => viewer.locator(`[data-row-index="${index}"]`).getByRole('gridcell');
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

	await expect(viewer.getByRole('gridcell', { name: 'Metric' })).toBeVisible();
	await expect(viewer.getByRole('gridcell', { name: 'Total SKUs' })).toBeVisible();
	await expect(viewer.getByRole('gridcell', { name: '787' })).toBeVisible();
	await expect(viewer.getByRole('gridcell', { name: 'Resistor kit' })).not.toBeVisible();
});

test('xlsx-viewer dark-mode toggle notifies the parent', async ({ page }) => {
	await page.goto('/xlsx-viewer');

	const viewer = page.getByTestId('xlsx-viewer').first();
	await expect(viewer.getByRole('tab', { name: 'Inventory' })).toBeVisible();
	await expect(viewer).toHaveAttribute('data-dark', 'false');

	await viewer.getByRole('switch', { name: 'Toggle dark mode' }).click();

	await expect(viewer).toHaveAttribute('data-dark', 'true');
});

test('xlsx-viewer shows error and boolean cells as text', async ({ page }) => {
	await page.goto('/xlsx-viewer');
	const viewer = page.getByTestId('xlsx-viewer').first();
	await viewer.getByRole('tab', { name: 'Checks' }).click();
	await expect(viewer.getByTestId('row-count')).toHaveText('1 row');

	await expect(viewer.locator('[data-row-index="0"]').getByRole('gridcell')).toHaveText([
		'=abc',
		'10',
		'TRUE',
		'5',
		'10',
		'999',
		'TRUE',
		'#DIV/0!',
		'#N/A'
	]);
});

test('xlsx-viewer sheet tabs: arrows move focus, Enter and Space activate, like upstream', async ({
	page
}) => {
	await page.goto('/xlsx-viewer');
	const viewer = page.getByTestId('xlsx-viewer').first();
	const tab = (name: string) => viewer.getByRole('tab', { name });
	await expect(tab('Inventory')).toHaveAttribute('tabindex', '0');
	await expect(tab('Summary')).toHaveAttribute('tabindex', '-1');

	await tab('Inventory').focus();
	await page.keyboard.press('ArrowRight');
	await expect(tab('Summary')).toBeFocused();
	await expect(tab('Summary')).toHaveAttribute('tabindex', '0');
	// Focus alone does not switch the sheet (upstream sets no activateOnFocus).
	await expect(tab('Inventory')).toHaveAttribute('aria-selected', 'true');
	await expect(viewer.getByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();

	await page.keyboard.press('Enter');
	await expect(tab('Summary')).toHaveAttribute('aria-selected', 'true');
	await expect(viewer.getByRole('gridcell', { name: 'Total SKUs' })).toBeVisible();
	await expect(tab('Summary')).toBeFocused();

	await page.keyboard.press('End');
	await expect(tab('Checks')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(tab('Inventory')).toBeFocused();
	await page.keyboard.press('Space');
	await expect(tab('Inventory')).toHaveAttribute('aria-selected', 'true');
	await expect(viewer.getByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();
});

test('xlsx-viewer selects cells and navigates by keyboard, read-only like upstream', async ({
	page
}) => {
	await page.goto('/xlsx-viewer');
	const viewer = page.getByTestId('xlsx-viewer').first();
	const grid = viewer.getByRole('grid');
	const kit = viewer.getByRole('gridcell', { name: 'Resistor kit' });
	await expect(kit).toBeVisible();
	await expect(grid).toHaveAttribute('tabindex', '0');

	await kit.click();
	await expect(grid).toBeFocused();
	await expect(kit).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ArrowRight');
	const qty = viewer.getByRole('gridcell', { name: '120', exact: true });
	await expect(qty).toHaveAttribute('aria-selected', 'true');
	await expect(grid).toHaveAttribute('aria-activedescendant', (await qty.getAttribute('id')) as string);
	await page.keyboard.press('ArrowDown');
	await expect(viewer.getByRole('gridcell', { name: '85', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);

	// Read-only: typing does not open an editor.
	await page.keyboard.type('9');
	await expect(viewer.locator('input')).toHaveCount(0);
	await expect(viewer.getByRole('gridcell', { name: '85', exact: true })).toBeVisible();
});
