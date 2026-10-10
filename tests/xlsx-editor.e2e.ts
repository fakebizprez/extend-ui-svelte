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

// These use real keystrokes, not .fill(): .fill() focuses the input itself and
// would hide a missing focus on edit start.
test('xlsx-editor double-click then typing replaces the value and Enter commits', async ({
	page
}) => {
	await page.goto('/xlsx-editor');

	const editor = page.getByTestId('xlsx-editor').first();
	const cell = editor.getByRole('gridcell', { name: '120', exact: true });
	await expect(cell).toBeVisible();

	await cell.dblclick();
	const input = editor.getByTestId('cell-input');
	await expect(input).toBeFocused();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('999');
	await expect(input).toHaveValue('999');
	await page.keyboard.press('Enter');

	await expect(input).toHaveCount(0);
	const edited = editor.getByRole('gridcell', { name: '999', exact: true });
	await expect(edited).toBeVisible();
	await expect(edited).toBeFocused();
	await expect(editor.getByTestId('formula-bar')).toHaveValue('999');
	await expect(page.getByTestId('last-change')).toContainText('999');
});

test('xlsx-editor Escape cancels a typed edit and restores the value', async ({ page }) => {
	await page.goto('/xlsx-editor');

	const editor = page.getByTestId('xlsx-editor').first();
	const cell = editor.getByRole('gridcell', { name: '120', exact: true });
	await expect(cell).toBeVisible();

	await cell.dblclick();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('999');
	await expect(editor.getByTestId('cell-input')).toHaveValue('999');
	await page.keyboard.press('Escape');

	await expect(editor.getByTestId('cell-input')).toHaveCount(0);
	await expect(cell).toBeVisible();
	await expect(cell).toBeFocused();
	await expect(editor.getByRole('gridcell', { name: '999', exact: true })).toHaveCount(0);
	await expect(editor.getByTestId('formula-bar')).toHaveValue('120');
	await expect(page.getByTestId('last-change')).toContainText('none yet');
});

test('xlsx-editor Enter on a selected cell focuses the edit input', async ({ page }) => {
	await page.goto('/xlsx-editor');

	const editor = page.getByTestId('xlsx-editor').first();
	const cell = editor.getByRole('gridcell', { name: 'Resistor kit', exact: true });
	await expect(cell).toBeVisible();

	await cell.click();
	await page.keyboard.press('Enter');

	const input = editor.getByTestId('cell-input');
	await expect(input).toBeVisible();
	expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
		'cell-input'
	);
	// Caret lands at the end, so typing appends.
	await page.keyboard.type(' pro');
	await expect(input).toHaveValue('Resistor kit pro');
	await page.keyboard.press('Enter');
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit pro' })).toBeFocused();
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

test('xlsx-editor keeps formulas: the bar shows the formula, the grid the value', async ({
	page
}) => {
	await page.goto('/xlsx-editor');
	const editor = page.getByTestId('xlsx-editor').first();
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();

	// Cross-sheet formula: shows the file's saved value.
	await editor.getByRole('tab', { name: 'Summary' }).click();
	await editor.getByRole('gridcell', { name: '787', exact: true }).click();
	await expect(editor.getByTestId('active-cell-address')).toHaveText('B3');
	await expect(editor.getByTestId('formula-bar')).toHaveValue('=SUM(Inventory!C2:C6)');

	// Same-sheet formula recalculates after an edit.
	await editor.getByRole('tab', { name: 'Lanes' }).click();
	await editor.getByRole('gridcell', { name: '7', exact: true }).click();
	await expect(editor.getByTestId('active-cell-address')).toHaveText('C6');
	await expect(editor.getByTestId('formula-bar')).toHaveValue('=SUM(C3:C5)');
	await editor.getByRole('gridcell', { name: '4', exact: true }).dblclick();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('10');
	await page.keyboard.press('Enter');
	await expect(editor.getByRole('gridcell', { name: '13', exact: true })).toBeVisible();
});

test('xlsx-editor export keeps cell addresses, blank rows, and formulas', async ({ page }) => {
	await page.goto('/xlsx-editor');
	const editor = page.getByTestId('xlsx-editor').first();
	await expect(editor.getByRole('gridcell', { name: 'Resistor kit' })).toBeVisible();
	await editor.getByRole('tab', { name: 'Lanes' }).click();
	const lane = editor.getByRole('gridcell', { name: 'Lane', exact: true });
	await lane.click();
	await expect(editor.getByTestId('active-cell-address')).toHaveText('B2');
	await editor.getByRole('gridcell', { name: 'Austin-Reno' }).click();
	await expect(editor.getByTestId('active-cell-address')).toHaveText('B5');

	const downloadPromise = page.waitForEvent('download');
	await editor.getByTestId('export-button').click();
	const download = await downloadPromise;
	const workbook = read(readFileSync((await download.path()) as string), { type: 'buffer' });

	const lanes = workbook.Sheets['Lanes'] as Record<string, { v?: unknown; f?: string }>;
	expect(lanes['A1']).toBeUndefined();
	expect(lanes['B2']?.v).toBe('Lane');
	expect(lanes['B3']?.v).toBe('Reno-Austin');
	expect(lanes['B4']).toBeUndefined();
	expect(lanes['B5']?.v).toBe('Austin-Reno');
	expect(lanes['C6']).toMatchObject({ f: 'SUM(C3:C5)', v: 7 });
	const summary = workbook.Sheets['Summary'] as Record<string, { v?: unknown; f?: string }>;
	expect(summary['B3']).toMatchObject({ f: 'SUM(Inventory!C2:C6)', v: 787 });
});
