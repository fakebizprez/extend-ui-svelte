// MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

const EXPECTED_TEXT = 'Hello from the DOCX fixture';
const SECOND_TEXT = 'Second paragraph for the thumbnail sidebar.';

test('renders the fixture document text', async ({ page }) => {
	await page.goto('/docx-viewer');

	await expect(page.getByTestId('docx-viewer')).toBeVisible();
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await expect(page.getByTestId('docx-container')).toContainText(SECOND_TEXT);
	await expect(page.getByTestId('docx-page-indicator')).toContainText(/Page \d+ of \d+/);
});

test('toggles the thumbnail sidebar', async ({ page }) => {
	await page.goto('/docx-viewer');

	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await expect(page.getByTestId('docx-thumbnails')).toHaveCount(0);

	await page.getByRole('button', { name: 'Toggle thumbnails' }).click();

	await expect(page.getByTestId('docx-thumbnails')).toBeVisible();
	await expect(page.getByRole('option', { name: 'Page 1' })).toBeVisible();
});

test('toggles dark mode from the toolbar', async ({ page }) => {
	await page.goto('/docx-viewer');

	const viewer = page.getByTestId('docx-viewer');
	await expect(viewer).toBeVisible();
	await expect(viewer).toHaveAttribute('data-dark', 'false');
	// The rendered document means the page has hydrated and handlers are live.
	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});

	await page.getByRole('switch', { name: 'Toggle dark mode' }).click();

	await expect(viewer).toHaveAttribute('data-dark', 'true');
	await expect(viewer).toHaveClass(/dark/);
});

test('starts at the upstream 50% zoom and fits the page width on request', async ({ page }) => {
	await page.goto('/docx-viewer');

	await expect(page.getByTestId('docx-container')).toContainText(EXPECTED_TEXT, {
		timeout: 20000
	});
	await expect(page.getByTestId('docx-zoom-level')).toHaveText('50%');

	await page.getByRole('combobox', { name: 'Zoom level' }).selectOption('fit-width');

	await expect(page.getByTestId('docx-zoom-level')).not.toHaveText('50%');
	// The zoomed page (with docx-preview's wrapper padding) spans the viewport's
	// content box, and the viewer itself does not grow wider than before.
	const viewerWidth = (await page.getByTestId('docx-viewer').boundingBox())?.width ?? 0;
	const widths = await page.evaluate(() => {
		const viewport = document.querySelector('[data-testid="docx-viewport"]') as HTMLElement;
		const wrapper = document.querySelector('.docx-wrapper') as HTMLElement;
		const style = getComputedStyle(viewport);
		const content =
			viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		return { content, page: wrapper.getBoundingClientRect().width };
	});
	expect(Math.abs(widths.page - widths.content)).toBeLessThan(4);
	expect(viewerWidth).toBeLessThanOrEqual(page.viewportSize()?.width ?? 1280);
});

test('docs page lists the differences from upstream', async ({ page }) => {
	await page.goto('/docx-viewer');

	const differences = page.getByRole('region', { name: 'Differences from upstream' });
	await expect(differences).toContainText('DocxViewerPreview');
	await expect(differences).toContainText('className');
});
