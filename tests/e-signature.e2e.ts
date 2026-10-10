// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

async function drawSignature(
	page: import('@playwright/test').Page,
	pad: import('@playwright/test').Locator
): Promise<void> {
	const box = await pad.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;
	const startX = box.x + 30;
	const midY = box.y + box.height / 2;
	await page.mouse.move(startX, midY);
	await page.mouse.down();
	for (let i = 1; i <= 12; i += 1) {
		await page.mouse.move(startX + i * 18, midY + (i % 2 === 0 ? -24 : 24), { steps: 3 });
	}
	await page.mouse.up();
}

test('drawing a signature enables placement', async ({ page }) => {
	await page.goto('/e-signature');

	const scope = page.getByTestId('e-signature').first();
	const pad = scope.getByTestId('e-signature-pad');
	await expect(pad).toHaveAttribute('data-pad-ready', 'true', { timeout: 30000 });
	await expect(scope).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });

	const place = scope.getByRole('button', { name: 'Place signature' });
	await expect(place).toBeDisabled();

	await drawSignature(page, pad);

	await expect(place).toBeEnabled();
	await expect(scope.getByTestId('e-signature-status')).toContainText('Signature ready');
});

test('placing the signature and exporting produces a signed pdf download', async ({ page }) => {
	await page.goto('/e-signature');

	const scope = page.getByTestId('e-signature').first();
	const pad = scope.getByTestId('e-signature-pad');
	await expect(pad).toHaveAttribute('data-pad-ready', 'true', { timeout: 30000 });
	await expect(scope).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });

	await drawSignature(page, pad);

	const place = scope.getByRole('button', { name: 'Place signature' });
	await expect(place).toBeEnabled();
	await place.click();

	const downloadButton = scope.getByRole('button', { name: 'Download signed PDF' });
	await expect(downloadButton).toBeEnabled({ timeout: 30000 });

	const downloadPromise = page.waitForEvent('download');
	await downloadButton.click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toMatch(/\.pdf$/);
	const path = await download.path();
	expect(path).toBeTruthy();
});
