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

test('file-thumbnail preview box matches the portrait page and shows it uncropped', async ({
	page
}) => {
	await page.goto('/file-thumbnail');

	const canvas = page.getByTestId('file-thumbnail-canvas');
	await expect(canvas).toBeVisible({ timeout: 30000 });
	await expect(page.getByTestId('file-thumbnail-loading')).toBeHidden({ timeout: 30000 });

	const box = await page.getByTestId('file-thumbnail-preview').boundingBox();
	expect(box).not.toBeNull();
	expect(box!.height).toBeGreaterThan(box!.width);

	// The box has the page's own shape, so object-fit: cover crops nothing.
	const pageAspect = await canvas.evaluate((node) => {
		const element = node as HTMLCanvasElement;
		return element.height / element.width;
	});
	expect(box!.height / box!.width).toBeCloseTo(pageAspect, 1);
});

test('file-thumbnail renders no theme toggle inside the thumbnail', async ({ page }) => {
	await page.goto('/file-thumbnail');

	const thumbnail = page.getByTestId('file-thumbnail');
	await expect(thumbnail).toBeVisible();
	await expect(thumbnail.getByRole('button')).toHaveCount(0);
});
