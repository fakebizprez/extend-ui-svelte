// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { read, utils } from 'xlsx';

test('xlsx-editor preview renders the fixture grid', async ({ page }) => {
	await page.goto('/xlsx-editor');

	await expect(page.locator('h1')).toContainText('XLSX Editor');

	const editor = page.getByTestId('xlsx-editor').first();
	await expect(editor.getByRole('tab', { name: 'Inventory' })).toBeVisible();
	await expect(editor.getByRole('tab', { name: 'Summary' })).toBeVisible();
	await expect(editor.getByRole('columnheader', { name: 'A' })).toBeVisible();
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();
	await expect(editor.getByTestId('export-button')).toBeVisible();
});

test('xlsx-editor cell edit persists across sheet switches', async ({ page }) => {
	await page.goto('/xlsx-editor');

	const editor = page.getByTestId('xlsx-editor').first();
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();

	await editor.getByRole('gridcell', { name: 'Resistor kit' }).dblclick();
	await editor.getByTestId('cell-input').fill('Resistor kit pro');
	await editor.getByTestId('cell-input').press('Enter');

	const edited = editor.getByRole('gridcell', { name: 'Resistor kit pro' });
	await expect(edited).toBeVisible();
	await expect(page.getByTestId('last-change')).toContainText('Resistor kit pro');

	// The edit survives switching away and back.
	await editor.getByRole('tab', { name: 'Summary' }).click();
	await expect(editor.getByRole('gridcell', { name: 'Total SKUs' })).toBeVisible();
	await editor.getByRole('tab', { name: 'Inventory' }).click();
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit pro' })).toBeVisible();

	// The formula bar shows the raw value of the selected cell.
	await edited.click();
	await expect(editor.getByTestId('formula-bar')).toHaveValue('Resistor kit pro');
});

test('xlsx-editor export produces an .xlsx download with the edits', async ({ page }) => {
	await page.goto('/xlsx-editor');

	const editor = page.getByTestId('xlsx-editor').first();
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();

	await editor.getByRole('gridcell', { name: 'Resistor kit' }).dblclick();
	await editor.getByTestId('cell-input').fill('Resistor kit pro');
	await editor.getByTestId('cell-input').press('Enter');
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit pro' })).toBeVisible();

	const downloadPromise = page.waitForEvent('download');
	await editor.getByTestId('export-button').click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
	await expect(page.getByTestId('last-export')).toContainText('.xlsx');

	const path = await download.path();
	expect(path).toBeTruthy();
	const workbook = read(readFileSync(path as string), { type: 'buffer' });
	expect(workbook.SheetNames).toContain('Inventory');
	const rows = utils.sheet_to_json<unknown[]>(workbook.Sheets['Inventory'], { header: 1 });
	expect(rows[1]).toEqual(['A-9001', 'Resistor kit pro', 120, 'Reno']);
});
