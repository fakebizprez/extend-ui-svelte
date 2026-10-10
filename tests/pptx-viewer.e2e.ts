// MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT).
// PPTX viewer: renders the 2-slide fixture deck through the docs preview page
// at src/routes/pptx-viewer with real canvas rendering in the browser.
import { expect, test } from '@playwright/test';

test('pptx viewer renders the fixture slide count', async ({ page }) => {
	await page.goto('/pptx-viewer');

	await expect(page.getByTestId('slide-count')).toHaveText('2');
});

test('pptx viewer renders one canvas per slide', async ({ page }) => {
	await page.goto('/pptx-viewer');

	const canvases = page.getByTestId('slide-canvas');
	await expect(canvases).toHaveCount(2);

	const size = await canvases.first().evaluate((el) => {
		const c = el as HTMLCanvasElement;
		return { width: c.width, height: c.height };
	});
	expect(size.width).toBeGreaterThan(0);
	expect(size.height).toBeGreaterThan(0);
});

test('pptx viewer has no theme toggle of its own; the page toggles it from outside', async ({
	page
}) => {
	await page.goto('/pptx-viewer');
	const viewer = page.getByTestId('pptx-viewer');
	await expect(page.getByTestId('slide-count')).toHaveText('2');

	await expect(viewer.getByRole('switch')).toHaveCount(0);
	await expect(viewer.getByRole('button', { name: /dark/i })).toHaveCount(0);

	await page.getByLabel('Dark mode').check();
	await expect(viewer).toHaveAttribute('data-dark', 'true');
});

test('pptx viewer docs page lists the differences from upstream', async ({ page }) => {
	await page.goto('/pptx-viewer');

	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('PptxViewerPreview');
	await expect(differences).toContainText('initialSlide');
});
