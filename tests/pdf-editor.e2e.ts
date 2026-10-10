// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

test('pdf editor loads the fixture and rotates a page', async ({ page }) => {
	await page.goto('/pdf-editor');

	const editor = page.getByTestId('pdf-editor').first();
	await expect(editor.getByTestId('pdf-editor-page-indicator')).toContainText('Page 1 of 3', {
		timeout: 30000
	});

	const entries = editor.getByTestId('pdf-editor-page');
	await expect(entries).toHaveCount(3);
	await expect(entries.first()).toHaveAttribute('data-rotation', '0');

	await editor.getByRole('button', { name: 'Rotate page 1 clockwise' }).click();
	await expect(entries.first()).toHaveAttribute('data-rotation', '90');
	await expect(entries.first()).toContainText('90°');
});

test('pdf editor deletes a page and exports the edited document', async ({ page }) => {
	await page.goto('/pdf-editor');

	const editor = page.getByTestId('pdf-editor').first();
	await expect(editor.getByTestId('pdf-editor-page-indicator')).toContainText('Page 1 of 3', {
		timeout: 30000
	});

	await editor.getByRole('button', { name: 'Delete page 2' }).click();
	await expect(editor.getByTestId('pdf-editor-page-indicator')).toContainText('Page 1 of 2');
	await expect(editor.getByTestId('pdf-editor-page')).toHaveCount(2);

	const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
	await editor.getByRole('button', { name: 'Export edited PDF' }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe('sample.pdf');
	const path = await download.path();
	expect(path).toBeTruthy();
	const bytes = await readFile(path as string);
	expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
	const exported = await PDFDocument.load(bytes);
	expect(exported.getPageCount()).toBe(2);
});
