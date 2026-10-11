// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
	test(`control labels meet text contrast in ${theme} mode`, async ({ page }) => {
		await page.addInitScript((theme) => localStorage.setItem('docs-theme', theme), theme);
		for (const [route, selector] of [
			['layout-blocks', '.layout-block-badge, .layout-block-page, .layout-block-confidence'],
			['bounding-box-citations', '.lead, .hr-tab, .hr-card-key, .hr-type']
		]) {
			await page.goto(`/${route}`);
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await page.addStyleTag({ content: '* { transition: none !important; }' });
			await expect(page.locator(selector).first()).toBeVisible();
			const ratios = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
				const context = document.createElement('canvas').getContext('2d')!;
				context.fillStyle = '#fff';
				context.fillRect(0, 0, 1, 1);
				const ancestors: Element[] = [];
				for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
				for (const node of ancestors) {
					context.fillStyle = getComputedStyle(node).backgroundColor;
					context.fillRect(0, 0, 1, 1);
				}
				const background = context.getImageData(0, 0, 1, 1).data;
				context.fillStyle = getComputedStyle(element).color;
				context.fillRect(0, 0, 1, 1);
				const foreground = context.getImageData(0, 0, 1, 1).data;
				const luminance = (rgb: Uint8ClampedArray) => Array.from(rgb.slice(0, 3)).reduce((sum, channel, i) => {
					const value = channel / 255;
					return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
				}, 0);
				const a = luminance(background), b = luminance(foreground);
				return { text: element.textContent, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
			}));
			expect(ratios.length).toBeGreaterThan(0);
			for (const result of ratios) expect(result.ratio, `${route}: ${result.text}`).toBeGreaterThanOrEqual(4.5);
		}
	});
}

test('document page scroll area is keyboard accessible', async ({ page }) => {
	await page.goto('/document-viewer-sidebar');
	await expect(page.getByTestId('viewer-content')).toHaveAttribute('tabindex', '0');
});

test('document split move controls meet the minimum target size', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 900 });
	await page.goto('/document-splits');
	await expect(page.getByText('Sample PDF: 3 pages')).toBeVisible({ timeout: 30000 });
	await expect(page.getByTestId('split-group')).toHaveCount(3);
	await expect(page.locator('.page-move').first()).toBeVisible();
	expect(await page.locator('.page-move').count()).toBeGreaterThan(0);
	for (const button of await page.locator('.page-move').all()) {
		const box = (await button.boundingBox())!;
		expect(box.width).toBeGreaterThanOrEqual(24);
		expect(box.height).toBeGreaterThanOrEqual(24);
	}
});
