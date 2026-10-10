// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('file-thumbnail preview renders a PDF page on a canvas', async ({ page }) => {
	await page.goto('/file-thumbnail');

	const canvas = page.getByTestId('file-thumbnail-canvas');
	await expect(canvas).toBeVisible({ timeout: 30000 });

	// The engine renders real pixels: the backing store is non-empty.
	const size = await canvas.evaluate((node) => {
		const element = node as HTMLCanvasElement;
		return { width: element.width, height: element.height };
	});
	expect(size.width).toBeGreaterThan(0);
	expect(size.height).toBeGreaterThan(0);

	await expect(page.getByTestId('file-thumbnail-loading')).toBeHidden();
	await expect(page.getByTestId('file-thumbnail-fallback')).toBeHidden();
});

test('file-thumbnail preview re-renders when the page number changes', async ({ page }) => {
	await page.goto('/file-thumbnail');

	const canvas = page.getByTestId('file-thumbnail-canvas');
	await expect(canvas).toBeVisible({ timeout: 30000 });

	const before = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());

	await page.getByTestId('thumbnail-page-input').fill('2');

	await expect
		.poll(async () => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL()), {
			timeout: 30000
		})
		.not.toBe(before);
});
