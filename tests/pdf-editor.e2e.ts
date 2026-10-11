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

function pageAction(editor: Locator, name: string): Locator {
	return editor.getByRole('toolbar', { name: 'Page actions' }).getByRole('button', { name });
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

	await pageAction(editor, 'Rotate right').click();
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
	const mixed = await PDFDocument.create();
	mixed.addPage([612, 792]);
	mixed.addPage([792, 612]);
	await editor.getByLabel('Upload PDF').setInputFiles({
		name: 'mixed.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from(await mixed.save())
	});
	await expect(page.getByTestId('pdf-editor-docs-loaded')).toContainText('Loaded mixed.pdf, 2 pages');
	// A new document resets zoom to defaultZoom, so pick 50% after it loads.
	await editor.getByRole('combobox', { name: 'Zoom level' }).selectOption('0.5');

	await editor.getByRole('option', { name: 'Page 2' }).click();
	const previewPage = editor.getByTestId('pdf-editor-preview').getByTestId('pdf-page');
	await expect.poll(() => boxSize(previewPage)).toEqual({ width: 396, height: 306 });
});

test('pdf editor deletes a page and downloads the edited document', async ({ page }) => {
	const editor = await openEditor(page);

	await editor.getByRole('option', { name: 'Page 2' }).click();
	await pageAction(editor, 'Delete pages').click();
	await editor.getByRole('dialog', { name: 'Delete this page?' }).getByRole('button', { name: 'Delete' }).click();
	await expect(editor.getByTestId('pdf-editor-page-indicator')).toContainText('Page 2 of 2');
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

	await pageAction(editor, 'Rotate right').click();
	await expect(editor.getByTestId('pdf-editor-page').first()).toHaveAttribute('data-rotation', '90');
	await expect.poll(async () => Math.abs((await centre()).y - before.y)).toBeLessThan(0.02);
});

test('pdf editor page list follows upstream\'s listbox keyboard and ARIA model', async ({ page }) => {
	const editor = await openEditor(page);
	const listbox = editor.getByRole('listbox', { name: 'Pages' });
	const indicator = editor.getByTestId('pdf-editor-page-indicator');

	// axe-style checks: focusable listbox, a valid active descendant, options with
	// aria-selected and no interactive descendants (nested-interactive).
	const audit = () =>
		listbox.evaluate((element) => {
			const options = [...element.querySelectorAll('[role="option"]')];
			const active = document.getElementById(element.getAttribute('aria-activedescendant') ?? '');
			return {
				tabIndex: element.tabIndex,
				activeIsOwnedOption: Boolean(active && element.contains(active) && active.getAttribute('role') === 'option'),
				activeName: active?.getAttribute('aria-label') ?? null,
				missingSelected: options.filter((option) => !option.hasAttribute('aria-selected')).length,
				nestedInteractive: options.reduce(
					(count, option) =>
						count +
						option.querySelectorAll('button, a[href], input, select, textarea, [tabindex]').length,
					0
				),
				unnamedOptions: options.filter((option) => !option.getAttribute('aria-label')).length
			};
		});
	expect(await audit()).toEqual({
		tabIndex: 0,
		activeIsOwnedOption: true,
		activeName: 'Page 1',
		missingSelected: 0,
		nestedInteractive: 0,
		unnamedOptions: 0
	});

	await listbox.focus();
	await page.keyboard.press('ArrowDown');
	await expect(indicator).toHaveText('Page 2 of 3');
	await page.keyboard.press('End');
	await expect(indicator).toHaveText('Page 3 of 3');
	await page.keyboard.press('Home');
	await expect(indicator).toHaveText('Page 1 of 3');
	await page.keyboard.press('ArrowDown');
	expect((await audit()).activeName).toBe('Page 2');
	await expect(listbox).toBeFocused();
});

test('pdf editor confirms deletes in the component and keeps the last page', async ({ page }) => {
	const editor = await openEditor(page);
	let nativeDialogs = 0;
	page.on('dialog', (dialog) => {
		nativeDialogs += 1;
		void dialog.dismiss();
	});

	await pageAction(editor, 'Delete pages').click();
	const dialog = editor.getByRole('dialog', { name: 'Delete this page?' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(pageAction(editor, 'Delete pages')).toBeFocused();
	await expect(editor.getByTestId('pdf-editor-page')).toHaveCount(3);

	for (const remaining of [2, 1]) {
		await pageAction(editor, 'Delete pages').click();
		await dialog.getByRole('button', { name: 'Delete' }).click();
		await expect(editor.getByTestId('pdf-editor-page')).toHaveCount(remaining);
	}
	await pageAction(editor, 'Delete pages').click();
	await expect(editor.getByRole('alert')).toHaveText('A document needs at least one page.');
	await expect(dialog).toHaveCount(0);
	await expect(editor.getByTestId('pdf-editor-page')).toHaveCount(1);
	expect(nativeDialogs).toBe(0);
});
