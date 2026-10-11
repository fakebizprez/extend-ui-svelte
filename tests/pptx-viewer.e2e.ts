// MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT).
// PPTX viewer: renders the 2-slide fixture deck through the docs preview page
// at src/routes/pptx-viewer with real canvas rendering in the browser.
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

	// Real slide content, not just a sized canvas: both slides carry title text,
	// and slide 1 carries the accent-blue "Fixture deck" shape.
	expect(await page.evaluate(blankCensus)).toEqual({ ink: 0, accent: 0 });
	await expect.poll(async () => (await canvases.nth(0).evaluate(canvasCensus)).ink).toBeGreaterThan(200);
	await expect.poll(async () => (await canvases.nth(0).evaluate(canvasCensus)).accent).toBeGreaterThan(5000);
	await expect.poll(async () => (await canvases.nth(1).evaluate(canvasCensus)).ink).toBeGreaterThan(200);
	expect((await canvases.nth(1).evaluate(canvasCensus)).accent).toBe(0);
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
