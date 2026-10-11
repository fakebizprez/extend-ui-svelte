// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function openViewer(page: Page, index = 0): Promise<Locator> {
	await page.goto('/pdf-viewer');
	const viewer = page.getByTestId('pdf-viewer').nth(index);
	await expect(viewer.getByTestId('pdf-page-indicator')).toContainText('Page 1 of 3', {
		timeout: 30000
	});
	return viewer;
}

async function boxSize(locator: Locator): Promise<{ width: number; height: number }> {
	const box = await locator.boundingBox();
	if (!box) throw new Error('element has no box');
	return { width: Math.round(box.width), height: Math.round(box.height) };
}

test('pdf viewer renders the fixture page count', async ({ page }) => {
	const viewer = await openViewer(page);

	await expect(viewer.getByTestId('pdf-viewport')).toBeVisible();
	await expect(viewer.getByTestId('pdf-page').first()).toBeVisible();
});

test('pdf viewer zoom buttons step through the upstream zoom levels', async ({ page }) => {
	const viewer = await openViewer(page);
	// The first demo starts at 50%, like the upstream docs preview.
	await expect(viewer.getByTestId('pdf-zoom-label')).toContainText('50%');

	await viewer.getByRole('button', { name: 'Zoom in' }).click();
	await expect(viewer.getByTestId('pdf-zoom-label')).toContainText('75%');

	await viewer.getByRole('button', { name: 'Zoom out' }).click();
	await viewer.getByRole('button', { name: 'Zoom out' }).click();
	await expect(viewer.getByTestId('pdf-zoom-label')).toContainText('25%');
});

test('pdf viewer fit width sizes pages to the viewport and follows resizes', async ({ page }) => {
	const viewer = await openViewer(page);
	const select = viewer.getByRole('combobox', { name: 'Zoom level' });
	await expect(select.locator('option')).toHaveText([
		'Fit page',
		'Fit width',
		'Automatic',
		'10%',
		'25%',
		'50%',
		'75%',
		'100%',
		'125%',
		'150%',
		'200%'
	]);

	await select.selectOption('fit-width');
	const viewport = viewer.getByTestId('pdf-viewport');
	const firstPage = viewer.getByTestId('pdf-page').first();
	// Upstream fit width: (viewport width - 2 * 24px gap) / page width, floored to 3 decimals.
	const widthError = async () => {
		const available = (await viewport.evaluate((element) => element.clientWidth)) - 2 * 24;
		const zoom = Math.floor((available / 612) * 1000) / 1000;
		return Math.abs((await boxSize(firstPage)).width - 612 * zoom);
	};
	await expect.poll(widthError).toBeLessThan(1.5);
	const fitLabel = (await viewer.getByTestId('pdf-zoom-label').textContent())?.trim() ?? '';
	expect(fitLabel).not.toBe('50%');

	await page.setViewportSize({ width: 700, height: 900 });
	await expect(viewer.getByTestId('pdf-zoom-label')).not.toHaveText(fitLabel);
	await expect.poll(widthError).toBeLessThan(1.5);
});

test('pdf viewer lays out each page at its real size', async ({ page }) => {
	const viewer = await openViewer(page);
	const mixed = await PDFDocument.create();
	mixed.addPage([612, 792]);
	mixed.addPage([792, 612]);
	mixed.addPage([300, 300]);
	await viewer.getByLabel('Upload PDF').setInputFiles({
		name: 'mixed.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from(await mixed.save())
	});

	const pages = viewer.getByTestId('pdf-page');
	await expect.poll(async () => boxSize(pages.nth(1))).toEqual({ width: 396, height: 306 });
	expect(await boxSize(pages.nth(0))).toEqual({ width: 306, height: 396 });
	expect(await boxSize(pages.nth(2))).toEqual({ width: 150, height: 150 });
});

test('pdf viewer rotates the active page and downloads the rotation', async ({ page }) => {
	const viewer = await openViewer(page);
	const firstPage = viewer.getByTestId('pdf-page').first();
	expect(await boxSize(firstPage)).toEqual({ width: 306, height: 396 });

	await viewer.getByRole('button', { name: 'Rotate clockwise' }).click();
	await expect(firstPage).toHaveAttribute('data-rotation', '90');
	expect(await boxSize(firstPage)).toEqual({ width: 396, height: 306 });
	await expect(viewer.getByTestId('pdf-page').nth(1)).toHaveAttribute('data-rotation', '0');

	const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
	await viewer.getByRole('button', { name: 'Download PDF' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('sample-rotated.pdf');
	const saved = await PDFDocument.load(await readFile((await download.path()) as string));
	expect(saved.getPages().map((pdfPage) => pdfPage.getRotation().angle)).toEqual([90, 0, 0]);
});

test('pdf viewer navigates pages', async ({ page }) => {
	const viewer = await openViewer(page);

	await viewer.getByRole('button', { name: 'Next page' }).click();
	await expect(viewer.getByTestId('pdf-page-indicator')).toContainText('Page 2 of 3');
});

test('pdf viewer theme demo is controlled from outside the viewer', async ({ page }) => {
	const viewer = await openViewer(page, 1);
	await expect(viewer).toHaveAttribute('data-dark', 'false');
	await expect(viewer.getByRole('switch')).toHaveCount(0);

	await page.getByRole('switch', { name: 'Dark mode' }).click();
	await expect(viewer).toHaveAttribute('data-dark', 'true');
});

test('pdf viewer empty source shows the upstream empty state', async ({ page }) => {
	await page.goto('/pdf-viewer');
	const empty = page.getByTestId('pdf-viewer').nth(2);

	await expect(empty.getByText('Upload a PDF to preview')).toBeVisible();
	await expect(empty.getByTestId('pdf-page-indicator')).toHaveText('Page 1 of –');
});

test('pdf viewer keeps the current page in view through zoom, fit width and rotate', async ({
	page
}) => {
	const viewer = await openViewer(page);
	const indicator = viewer.getByTestId('pdf-page-indicator');
	const viewport = viewer.getByTestId('pdf-viewport');
	const pageTwo = viewer.locator('[data-page-number="2"]');
	const pageTwoInView = async () => {
		const [view, box] = await Promise.all([viewport.boundingBox(), pageTwo.boundingBox()]);
		return Boolean(view && box && box.y < view.y + view.height && box.y + box.height > view.y);
	};

	await viewer.getByRole('button', { name: 'Next page' }).click();
	await expect(indicator).toHaveText('Page 2 of 3');

	await viewer.getByRole('button', { name: 'Zoom in' }).click();
	await expect(viewer.getByTestId('pdf-zoom-label')).toHaveText('75%');
	await expect(indicator).toHaveText('Page 2 of 3');
	expect(await pageTwoInView()).toBe(true);

	await viewer.getByRole('combobox', { name: 'Zoom level' }).selectOption('fit-width');
	await expect(viewer.getByTestId('pdf-zoom-label')).not.toHaveText('75%');
	await expect(indicator).toHaveText('Page 2 of 3');
	expect(await pageTwoInView()).toBe(true);

	await viewer.getByRole('button', { name: 'Rotate clockwise' }).click();
	await expect(pageTwo).toHaveAttribute('data-rotation', '90');
	await expect(indicator).toHaveText('Page 2 of 3');
	expect(await pageTwoInView()).toBe(true);
});

test('pdf viewer resets zoom to defaultZoom when a new document loads', async ({ page }) => {
	const viewer = await openViewer(page);
	await viewer.getByRole('button', { name: 'Zoom in' }).click();
	await expect(viewer.getByTestId('pdf-zoom-label')).toHaveText('75%');

	const next = await PDFDocument.create();
	next.addPage([612, 792]);
	await viewer.getByLabel('Upload PDF').setInputFiles({
		name: 'next.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from(await next.save())
	});
	await expect(viewer.getByTestId('pdf-page-indicator')).toHaveText('Page 1 of 1');
	await expect(viewer.getByTestId('pdf-zoom-label')).toHaveText('50%');
});

test('pdf viewer marks the most visible page as current, like upstream', async ({ page }) => {
	const viewer = await openViewer(page);
	const viewport = viewer.getByTestId('pdf-viewport');
	await viewport.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});

	await expect(viewer.getByTestId('pdf-page-indicator')).toHaveText('Page 3 of 3');
	await expect(viewer.getByRole('button', { name: 'Next page' })).toBeDisabled();
});
