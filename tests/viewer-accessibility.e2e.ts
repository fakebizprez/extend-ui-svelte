// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

for (const route of ['pdf-viewer', 'pdf-editor']) {
	test(`${route} keeps unavailable document zoom labels readable`, async ({ page }) => {
		await page.route('**/*.pdf', (request) => request.abort());
		await page.goto(`/${route}`);
		const label = page.getByTestId(`${route === 'pdf-viewer' ? 'pdf' : 'pdf-editor'}-zoom-label`).last();
		await expect(label).toHaveCSS('opacity', '1');
	});
}
