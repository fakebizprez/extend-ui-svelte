// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Regression: page overlays must rotate with the page, so a citation box keeps
// covering its cited text after Rotate clockwise.
import { expect, test, type Locator } from '@playwright/test';

/** Share of the element's area that covers dark (text) pixels on its page canvas. */
function inkUnder(element: Locator): Promise<number> {
	return element.evaluate((node) => {
		const canvas = node.closest('[data-page-number]')?.querySelector('canvas');
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return 0;
		const box = node.getBoundingClientRect();
		const page = canvas.getBoundingClientRect();
		const scaleX = canvas.width / page.width;
		const scaleY = canvas.height / page.height;
		const width = Math.max(1, Math.round(box.width * scaleX));
		const height = Math.max(1, Math.round(box.height * scaleY));
		const { data } = context.getImageData(
			Math.round((box.left - page.left) * scaleX),
			Math.round((box.top - page.top) * scaleY),
			width,
			height
		);
		let ink = 0;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] > 0 && Math.min(data[i], data[i + 1], data[i + 2]) < 160) ink++;
		}
		return ink / (width * height);
	});
}

/** Element box as fractions of its page box: [left, top, width, height]. */
function boxInPage(element: Locator): Promise<number[]> {
	return element.evaluate((node) => {
		const page = node.closest('[data-page-number]')!.getBoundingClientRect();
		const box = node.getBoundingClientRect();
		return [
			(box.left - page.left) / page.width,
			(box.top - page.top) / page.height,
			box.width / page.width,
			box.height / page.height
		];
	});
}

test('citation boxes still cover their text after rotating the page', async ({ page }) => {
	await page.goto('/bounding-box-citations');
	const block = page.getByTestId('bounding-box-citations');
	await expect(block.getByTestId('pdf-page-indicator')).toContainText('Page 1 of 1', {
		timeout: 30000
	});
	await page.waitForLoadState('networkidle');
	const box = block.locator('[data-testid="citation-box"][data-field-key="statement_period"]');
	await expect.poll(() => inkUnder(box), { timeout: 10000 }).toBeGreaterThan(0.02);
	const [left, top, width, height] = await boxInPage(box);

	await block.getByRole('button', { name: 'Rotate clockwise' }).click();
	await expect(block.locator('[data-page-number="1"]')).toHaveAttribute('data-rotation', '90');
	// A clockwise quarter turn maps (left, top, width, height) to (1 - top - height, left, height, width).
	const expected = [1 - top! - height!, left!, height!, width!];
	await expect
		.poll(async () => Math.max(...(await boxInPage(box)).map((value, i) => Math.abs(value - expected[i]!))))
		.toBeLessThan(0.01);
	await expect.poll(() => inkUnder(box), { timeout: 10000 }).toBeGreaterThan(0.02);

	// Scroll-to-area must aim at the rotated position too.
	await block.getByRole('combobox', { name: 'Zoom level' }).selectOption('2');
	await block
		.locator('[data-review-field="statement_period"]')
		.getByLabel('Expected statement_period')
		.focus();
	const highlight = block.getByTestId('citation-highlight');
	await block.getByTestId('pdf-viewport').scrollIntoViewIfNeeded();
	await expect(highlight).toBeInViewport({ ratio: 0.9 });
	await expect.poll(() => inkUnder(highlight), { timeout: 10000 }).toBeGreaterThan(0.02);
});
