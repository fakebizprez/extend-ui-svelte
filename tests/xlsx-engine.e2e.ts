// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('xlsx engine harness loads the fixture and reports sheets', async ({ page }) => {
	await page.goto('/engines/xlsx');

	await expect(page.locator('h1')).toContainText('XLSX Engine Harness');
	await expect(page.getByTestId('sheet-count')).toContainText('3 sheets');

	const sheets = page.getByTestId('sheet-item');
	await expect(sheets).toHaveCount(3);
	await expect(sheets.nth(0)).toContainText('Inventory');
	await expect(sheets.nth(0)).toContainText('5 rows');
	await expect(sheets.nth(1)).toContainText('Summary');
	await expect(sheets.nth(1)).toContainText('2 rows');
	await expect(sheets.nth(2)).toContainText('Notes');
	await expect(sheets.nth(2)).toContainText('3 rows');
});
