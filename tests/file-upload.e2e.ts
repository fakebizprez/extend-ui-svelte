// MIT License — Svelte 5 port of Extend UI file-upload. Upstream: extend-hq/ui (MIT).
import { expect, test, type Page } from '@playwright/test';

const LABELS = ['IMG', 'PDF', 'XLS'];

// For each icon card: is the card itself the topmost element at a point on its
// label? `side` picks the label's outer edge for side cards (left for the first,
// right for the last) and the center for the middle card.
async function labelsShowing(page: Page): Promise<Record<string, boolean>> {
	return page.locator('.icon-card').evaluateAll((cards) =>
		Object.fromEntries(
			cards.map((card, index) => {
				const label = card.querySelector('.icon-glyph') as HTMLElement;
				const rect = label.getBoundingClientRect();
				const fraction = index === 0 ? 0.2 : index === cards.length - 1 ? 0.8 : 0.5;
				const hit = document.elementFromPoint(
					rect.x + rect.width * fraction,
					rect.y + rect.height / 2
				);
				return [label.textContent?.trim() ?? '', !!hit && card.contains(hit)];
			})
		)
	);
}

test('drop area shows three file-type cards with the PDF card on top', async ({ page }) => {
	await page.goto('/file-upload');

	const cards = page.locator('.icon-card');
	await expect(cards).toHaveCount(3);
	for (const [index, label] of LABELS.entries()) {
		await expect(cards.nth(index)).toBeVisible();
		await expect(cards.nth(index)).toHaveText(label);
	}
	// Idle, like upstream: the side cards tuck behind the middle card.
	expect((await labelsShowing(page)).PDF).toBe(true);
});

test('dragging a file over the drop area fans out all three cards with their labels', async ({
	page
}) => {
	await page.goto('/file-upload');
	// Drag events before hydration are dropped on the dev server.
	await page.waitForLoadState('networkidle');

	const dropzone = page.locator('.dropzone').first();
	const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
	await dropzone.dispatchEvent('dragenter', { dataTransfer });
	await expect(page.getByText('Drop to add')).toBeVisible();

	// Like upstream, the side cards fan out past the middle card; wait out the 500ms transition.
	await expect.poll(() => labelsShowing(page), { timeout: 5000 }).toEqual({
		IMG: true,
		PDF: true,
		XLS: true
	});
});

test('the drop area has no dark-mode control and file rows use FileThumbnail', async ({ page }) => {
	await page.goto('/file-upload');
	await page.waitForLoadState('networkidle');

	const root = page.locator('.file-upload');
	await expect(root.getByRole('button', { name: /dark mode/i })).toHaveCount(0);
	await expect(root.getByText('Dark', { exact: true })).toHaveCount(0);

	await root.locator('input[type="file"]').setInputFiles([
		{ name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
		{
			name: 'pixel.png',
			mimeType: 'image/png',
			buffer: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				'base64'
			)
		}
	]);

	const thumbnails = root.locator('.file-row [data-testid="file-thumbnail"]');
	await expect(thumbnails).toHaveCount(2);
	await expect(thumbnails.nth(1).getByTestId('file-thumbnail-image')).toBeVisible();
	const box = await thumbnails.first().boundingBox();
	expect(Math.round(box!.width)).toBe(40);
	expect(Math.round(box!.height)).toBe(40);

	// The parent's toggle, outside the component, drives the theme of the rows too.
	await page.getByLabel('Dark mode').check();
	await expect(root).toHaveClass(/\bdark\b/);
	await expect(thumbnails.first()).toHaveClass(/\bdark\b/);
});

test('idle drop area shows upstream dashed border; the beam appears only while dragging', async ({
	page
}) => {
	await page.goto('/file-upload');
	await page.waitForLoadState('networkidle');

	const dropzone = page.locator('.dropzone').first();
	const beam = page.locator('.beam').first();
	// Upstream idle: border border-dashed border-foreground/20, no beam.
	await expect(dropzone).toHaveCSS('border-top-style', 'dashed');
	const idleBorder = await dropzone.evaluate((node) => getComputedStyle(node).borderTopColor);
	expect(idleBorder).not.toBe('rgba(0, 0, 0, 0)');
	await expect(beam).toHaveCSS('background-image', 'none');

	const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
	await dropzone.dispatchEvent('dragenter', { dataTransfer });
	await expect(beam).toHaveCSS('background-image', /conic-gradient/);
	await expect(dropzone).toHaveCSS('border-top-style', 'dashed');
});

test('dropping two identical files lists both, like upstream', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/file-upload');
	await page.waitForLoadState('networkidle');

	const upload = page.locator('.file-upload').first();
	const dataTransfer = await page.evaluateHandle(() => {
		const transfer = new DataTransfer();
		for (let i = 0; i < 2; i += 1) {
			transfer.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf', lastModified: 1 }));
		}
		return transfer;
	});
	await upload.locator('.dropzone').dispatchEvent('drop', { dataTransfer });

	await expect(upload.locator('.file-row')).toHaveCount(2);
	await expect(upload.locator('.file-name')).toHaveText(['a.pdf', 'a.pdf']);
	expect(errors).toEqual([]);
});
