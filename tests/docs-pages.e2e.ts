import { expect, test } from '@playwright/test';

const SLUGS = [
	'file-upload',
	'csv-tsv-viewer',
	'document-viewer-sidebar',
	'file-thumbnail',
	'pdf-viewer',
	'docx-viewer',
	'xlsx-viewer',
	'pptx-viewer',
	'pdf-editor',
	'docx-editor',
	'xlsx-editor',
	'file-system',
	'document-splits',
	'schema-builder',
	'layout-blocks',
	'bounding-box-citations',
	'e-signature',
	'group',
	'color-picker',
	'toggle'
];

test('home page links to every component preview', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toContainText('Extend UI Svelte');

	for (const slug of SLUGS) {
		await expect(page.getByRole('link', { name: slug }).first()).toBeVisible();
	}
});

for (const slug of SLUGS) {
	test(`${slug} preview page renders a heading`, async ({ page }) => {
		await page.goto(`/${slug}`);
		await expect(page.locator('h1').first()).toBeVisible();
	});
}
