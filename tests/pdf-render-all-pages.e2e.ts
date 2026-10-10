// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Regression: pages drawn at the same time used to cancel each other, so only
// the last page in view rendered and the rest showed "Rendering cancelled".
import { expect, test, type Page } from '@playwright/test';

/** Count canvases on the page that are still blank (no non-white pixel). */
function blankCanvasCount(page: Page): Promise<number> {
	return page.evaluate(() => {
		const canvases = Array.from(document.querySelectorAll('canvas'));
		return canvases.filter((canvas) => {
			const context = canvas.getContext('2d');
			if (!context || canvas.width === 0 || canvas.height === 0) return true;
			const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
			for (let i = 0; i < data.length; i += 4) {
				if (data[i + 3] !== 0 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)) {
					return false;
				}
			}
			return true;
		}).length;
	});
}

// The citations demo uses upstream's one-page bank statement; the others draw several pages.
const ROUTES = [
	{ route: '/pdf-viewer', minCanvases: 2 },
	{ route: '/pdf-editor', minCanvases: 2 },
	{ route: '/bounding-box-citations', minCanvases: 1 }
];

for (const { route, minCanvases } of ROUTES) {
	test(`${route} draws every page without cancelling`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 });
		expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(minCanvases);

		await expect.poll(() => blankCanvasCount(page), { timeout: 15000 }).toBe(0);
		await expect(page.getByText(/rendering cancelled/i)).toHaveCount(0);
	});
}
