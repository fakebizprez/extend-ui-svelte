// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function openEditor(page: Page): Promise<Locator> {
	await page.goto('/pdf-editor');
	const editor = page.getByTestId('pdf-editor').first();
	await expect(editor.getByTestId('pdf-editor-page-indicator')).toContainText('Page 1 of 3', {
		timeout: 30000
	});
	return editor;
}

async function boxSize(locator: Locator): Promise<{ width: number; height: number }> {
	const box = await locator.boundingBox();
	if (!box) throw new Error('element has no box');
	return { width: box.width, height: box.height };
}

test('pdf editor loads the fixture and rotates a page', async ({ page }) => {
	const editor = await openEditor(page);

	const entries = editor.getByTestId('pdf-editor-page');
	await expect(entries).toHaveCount(3);
	await expect(entries.first()).toHaveAttribute('data-rotation', '0');

	await editor.getByRole('button', { name: 'Rotate page 1 clockwise' }).click();
	await expect(entries.first()).toHaveAttribute('data-rotation', '90');
	await expect(entries.first()).toContainText('90°');
});

test('pdf editor reports the upstream load payload', async ({ page }) => {
	await openEditor(page);

	await expect(page.getByTestId('pdf-editor-docs-loaded')).toHaveText(
		/^Loaded sample\.pdf, 3 pages, id pdf-editor-document-\d+$/
	);
});

test('pdf editor starts at fit width', async ({ page }) => {
	const editor = await openEditor(page);
	await expect(editor.getByRole('combobox', { name: 'Zoom level' })).toHaveValue('fit-width');

	const preview = editor.getByTestId('pdf-editor-preview');
	const previewPage = preview.getByTestId('pdf-page');
	// Upstream fit width: (pane width - 2 * 24px gap) / page width, floored to 3 decimals.
	const widthError = async () => {
		const available = (await preview.evaluate((element) => element.clientWidth)) - 2 * 24;
		const zoom = Math.floor((available / 612) * 1000) / 1000;
		return Math.abs((await boxSize(previewPage)).width - 612 * zoom);
	};
	await expect.poll(widthError).toBeLessThan(1.5);
});

test('pdf editor previews an uploaded page at its real size', async ({ page }) => {
	const editor = await openEditor(page);
	await editor.getByRole('combobox', { name: 'Zoom level' }).selectOption('0.5');
	const mixed = await PDFDocument.create();
	mixed.addPage([612, 792]);
	mixed.addPage([792, 612]);
	await editor.getByLabel('Upload PDF').setInputFiles({
		name: 'mixed.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from(await mixed.save())
	});
	await expect(page.getByTestId('pdf-editor-docs-loaded')).toContainText('Loaded mixed.pdf, 2 pages');

	await editor.getByRole('button', { name: 'Select page 2' }).click();
	const previewPage = editor.getByTestId('pdf-editor-preview').getByTestId('pdf-page');
	await expect.poll(() => boxSize(previewPage)).toEqual({ width: 396, height: 306 });
});

test('pdf editor deletes a page and downloads the edited document', async ({ page }) => {
	const editor = await openEditor(page);

	await editor.getByRole('button', { name: 'Delete page 2' }).click();
	await expect(editor.getByTestId('pdf-editor-page-indicator')).toContainText('Page 1 of 2');
	await expect(editor.getByTestId('pdf-editor-page')).toHaveCount(2);

	const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
	await editor.getByRole('button', { name: 'Download', exact: true }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe('sample.pdf');
	const bytes = await readFile((await download.path()) as string);
	expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
	const exported = await PDFDocument.load(bytes);
	expect(exported.getPageCount()).toBe(2);
});

test('pdf editor dark mode is controlled from outside the editor', async ({ page }) => {
	const editor = await openEditor(page);
	await expect(editor).toHaveAttribute('data-dark', 'false');
	await expect(editor.getByRole('switch')).toHaveCount(0);

	await page.getByRole('switch', { name: 'Dark mode' }).click();
	await expect(editor).toHaveAttribute('data-dark', 'true');
});

test('pdf editor preview keeps its centre point through zoom and rotate', async ({ page }) => {
	const editor = await openEditor(page);
	const preview = editor.getByTestId('pdf-editor-preview');
	const centre = () =>
		preview.evaluate((element) => ({
			y: (element.scrollTop + element.clientHeight / 2) / element.scrollHeight,
			x: (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
		}));
	await editor.getByRole('combobox', { name: 'Zoom level' }).selectOption('1.5');
	await preview.evaluate((element) => {
		element.scrollTop = element.scrollHeight * 0.6 - element.clientHeight / 2;
		element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
	});
	const before = await centre();

	await editor.getByRole('button', { name: 'Zoom in' }).click();
	await expect(editor.getByTestId('pdf-editor-zoom-label')).toHaveText('170%');
	await expect.poll(async () => Math.abs((await centre()).y - before.y)).toBeLessThan(0.02);
	expect(Math.abs((await centre()).x - before.x)).toBeLessThan(0.02);

	await editor.getByRole('button', { name: 'Rotate page 1 clockwise' }).click();
	await expect(editor.getByTestId('pdf-editor-page').first()).toHaveAttribute('data-rotation', '90');
	await expect.poll(async () => Math.abs((await centre()).y - before.y)).toBeLessThan(0.02);
});
