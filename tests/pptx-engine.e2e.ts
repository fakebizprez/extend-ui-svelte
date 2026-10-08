// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// PPTX engine wrapper: loads the 2-slide fixture deck in a real browser and
// renders slide 1 through the src/routes/engines/pptx/ harness page.
import { expect, test } from '@playwright/test';

test('pptx engine loads the fixture deck and reports 2 slides', async ({ page }) => {
	await page.goto('/engines/pptx');

	await expect(page.getByTestId('status')).toHaveText('ready');
	await expect(page.getByTestId('slide-count')).toHaveText('2');
});

test('pptx engine renders the first slide onto a canvas', async ({ page }) => {
	await page.goto('/engines/pptx');

	const canvas = page.getByTestId('slide-canvas');
	await expect(page.getByTestId('status')).toHaveText('ready');
	await expect(canvas).toBeVisible();

	const size = await canvas.evaluate((el) => {
		const c = el as HTMLCanvasElement;
		return { width: c.width, height: c.height };
	});
	expect(size.width).toBeGreaterThan(0);
	expect(size.height).toBeGreaterThan(0);
});
