// MIT License — Svelte 5 port of Extend UI docx-editor. Upstream: extend-hq/ui (MIT).
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

const EXPECTED_TEXT = 'Hello from the DOCX fixture';

test('loads the fixture document into the editable surface', async ({ page }) => {
	await page.goto('/docx-editor');

	await expect(page.getByTestId('docx-editor')).toBeVisible();
	await expect(page.getByTestId('docx-editor-content')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await expect(page.getByTestId('docx-editor-content')).toHaveAttribute('contenteditable', 'true');
});

test('applies bold formatting through the toolbar', async ({ page }) => {
	await page.goto('/docx-editor');
	const editor = page.getByTestId('docx-editor-content');
	await expect(editor).toContainText(EXPECTED_TEXT, { timeout: 20000 });

	await editor.selectText();
	await page.getByRole('button', { name: 'Bold' }).click();

	// Bold wraps each paragraph separately, so assert on content, not count.
	await expect(editor.locator('strong,b').first()).toContainText(EXPECTED_TEXT);
});

test('applies heading and list formatting through the toolbar', async ({ page }) => {
	await page.goto('/docx-editor');
	const editor = page.getByTestId('docx-editor-content');
	await expect(editor).toContainText(EXPECTED_TEXT, { timeout: 20000 });

	await editor.selectText();
	await page.getByLabel('Block style').selectOption('h2');
	await expect(editor.locator('h2')).toHaveCount(1);

	await editor.selectText();
	await page.getByRole('button', { name: 'Bulleted list' }).click();
	await expect(editor.locator('ul > li')).not.toHaveCount(0);
});

test('export produces a .docx download with the edited text', async ({ page }) => {
	await page.goto('/docx-editor');
	const editor = page.getByTestId('docx-editor-content');
	await expect(editor).toContainText(EXPECTED_TEXT, { timeout: 20000 });

	await editor.selectText();
	await page.getByRole('button', { name: 'Bold' }).click();

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export .docx' }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toMatch(/\.docx$/);
	const path = await download.path();
	expect(path).toBeTruthy();
	const zip = await JSZip.loadAsync(readFileSync(path as string));
	const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
	expect(documentXml).toContain(EXPECTED_TEXT);
	expect(documentXml).toContain('<w:b/>');
});

test('zooms the editable surface through the upstream zoom steps', async ({ page }) => {
	await page.goto('/docx-editor');
	const editor = page.getByTestId('docx-editor-content');
	await expect(editor).toContainText(EXPECTED_TEXT, { timeout: 20000 });
	const before = (await editor.boundingBox())?.height ?? 0;

	await page.getByRole('combobox', { name: 'Zoom level' }).selectOption('150');

	await expect(editor).toHaveAttribute('style', /zoom: 150%/);
	await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(before);
});

test('docs page lists the differences from upstream', async ({ page }) => {
	await page.goto('/docx-editor');

	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('DocxEditorPreview');
	await expect(differences).toContainText('lossy');
});
