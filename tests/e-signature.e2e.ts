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

for (const width of [1280, 390]) {
	test(`placement controls stay inside the card without overlapping at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/e-signature');

		const cards = page.getByTestId('e-signature');
		await expect(cards.first()).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });
		await expect(cards.nth(1)).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });

		for (const card of [cards.first(), cards.nth(1)]) {
			const cardBox = await card.boundingBox();
			expect(cardBox).not.toBeNull();
			if (!cardBox) return;
			const inputs = card.locator('input');
			const boxes = [];
			for (let i = 0; i < (await inputs.count()); i += 1) {
				const box = await inputs.nth(i).boundingBox();
				expect(box).not.toBeNull();
				if (box) boxes.push(box);
			}
			expect(boxes.length).toBeGreaterThanOrEqual(4);

			for (const box of boxes) {
				expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
				expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
			}
			for (const button of await card.getByRole('button').all()) {
				const box = await button.boundingBox();
				expect(box).not.toBeNull();
				if (!box) continue;
				expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
				expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
			}
			for (let i = 0; i < boxes.length; i += 1) {
				for (let j = i + 1; j < boxes.length; j += 1) {
					const a = boxes[i];
					const b = boxes[j];
					const overlaps =
						a.x < b.x + b.width &&
						b.x < a.x + a.width &&
						a.y < b.y + b.height &&
						b.y < a.y + a.height;
					expect(overlaps, `inputs ${i} and ${j} overlap`).toBe(false);
				}
			}
		}
	});
}

test('loads the document from the upstream file prop with no theme toggle inside', async ({
	page
}) => {
	await page.goto('/e-signature');
	const scope = page.getByTestId('e-signature').first();
	await expect(scope).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });

	await expect(scope.getByRole('switch')).toHaveCount(0);
	await page.getByLabel('Dark mode').check();
	await expect(scope).toHaveAttribute('data-dark', 'true');
});

test('docs page lists the differences from upstream', async ({ page }) => {
	await page.goto('/e-signature');

	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('ESignatureBlock');
	await expect(differences).toContainText('signed-document.pdf');
});

for (const width of [1280, 390]) {
	test(`ink lands under the pointer at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/e-signature');

		const scope = page.getByTestId('e-signature').first();
		const pad = scope.getByTestId('e-signature-pad');
		await expect(pad).toHaveAttribute('data-pad-ready', 'true', { timeout: 30000 });
		// The PDF preview loading can shift the layout; draw only once it has settled.
		await expect(scope).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });
		const first = await pad.boundingBox();
		expect(first).not.toBeNull();
		if (!first) return;

		// Known points, in CSS pixels from the pad's top-left corner.
		const points = [
			{ x: Math.round(first.width * 0.8), y: 60 },
			{ x: Math.round(first.width * 0.3), y: 140 }
		];
		for (const point of points) {
			const box = (await pad.boundingBox()) ?? first;
			await page.mouse.move(box.x + point.x - 12, box.y + point.y);
			await page.mouse.down();
			await page.mouse.move(box.x + point.x + 12, box.y + point.y, { steps: 6 });
			await page.mouse.up();
		}

		const inked = await pad.evaluate((element, targets) => {
			const canvas = element as HTMLCanvasElement;
			const rect = canvas.getBoundingClientRect();
			const context = canvas.getContext('2d');
			if (!context) return targets.map(() => false);
			return targets.map(({ x, y }) => {
				const bx = Math.round((x * canvas.width) / rect.width);
				const by = Math.round((y * canvas.height) / rect.height);
				const { data } = context.getImageData(bx - 2, by - 2, 5, 5);
				for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
				return false;
			});
		}, points);
		expect(inked).toEqual([true, true]);
	});
}

test('the signature pad stays white in dark mode, like upstream', async ({
	page
}) => {
	await page.goto('/e-signature');
	const darkPad = page.getByTestId('e-signature').nth(1).getByTestId('e-signature-pad');
	await expect(darkPad).toHaveAttribute('data-pad-ready', 'true', { timeout: 30000 });
	await expect(darkPad).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
