import { expect, test } from '@playwright/test';
import { PREVIEW_COMPONENTS } from '../src/routes/components';

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

	for (const { title } of PREVIEW_COMPONENTS) {
		await expect(page.getByRole('link', { name: title, exact: true }).first()).toBeVisible();
	}
});

for (const slug of SLUGS) {
	test(`${slug} preview page renders a heading`, async ({ page }) => {
		await page.goto(`/${slug}`);
		await expect(page.locator('h1').first()).toBeVisible();
	});
}

// Regression: the side menu took the width on phones and pages scrolled sideways.
for (const slug of SLUGS) {
	test(`${slug} page has no sideways scroll at phone width`, async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`/${slug}`);
		await page.waitForLoadState('networkidle');
		await expect(page.locator('h1').first()).toBeVisible();

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});
}

test('docs pages keep a 16px side gutter at phone width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/toggle');
	const left = await page.locator('h1').first().evaluate((h1) => h1.getBoundingClientRect().left);
	expect(left).toBe(16);
});
