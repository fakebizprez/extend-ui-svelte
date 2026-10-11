// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// PPTX engine wrapper: loads the 2-slide fixture deck in a real browser and
// renders slide 1 through the src/routes/engines/pptx/ harness page.
import { expect, test } from '@playwright/test';

/**
 * Pixel census of a canvas: `ink` counts dark pixels (rendered text), `accent`
 * counts pixels near the fixture's accent blue (#2563EB, slide 1's shape).
 * A blank or background-only canvas scores zero on both.
 */
function canvasCensus(el: Element): { ink: number; accent: number } {
	const canvas = el as HTMLCanvasElement;
	const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
	let ink = 0;
	let accent = 0;
	for (let i = 0; i < data.length; i += 4) {
		const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
		if (a < 128) continue;
		if (r < 90 && g < 90 && b < 90) ink += 1;
		if (Math.abs(r - 0x25) < 40 && Math.abs(g - 0x63) < 40 && Math.abs(b - 0xeb) < 40) accent += 1;
	}
	return { ink, accent };
}

/** The census applied to a fresh blank canvas, proving it detects "nothing drawn". */
function blankCensus(): { ink: number; accent: number } {
	const blank = document.createElement('canvas');
	blank.width = 960;
	blank.height = 540;
	const context = blank.getContext('2d')!;
	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, blank.width, blank.height);
	const data = context.getImageData(0, 0, blank.width, blank.height).data;
	let ink = 0;
	for (let i = 0; i < data.length; i += 4) if (data[i] < 90) ink += 1;
	return { ink, accent: 0 };
}

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

	// Slide 1 really drew: title text (dark ink) and the accent-blue shape.
	expect(await page.evaluate(blankCensus)).toEqual({ ink: 0, accent: 0 });
	await expect.poll(async () => (await canvas.evaluate(canvasCensus)).ink).toBeGreaterThan(200);
	await expect.poll(async () => (await canvas.evaluate(canvasCensus)).accent).toBeGreaterThan(5000);
});
