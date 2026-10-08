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

	await page.getByRole('switch', { name: 'Toggle dark mode' }).click();

	await expect(viewer).toHaveAttribute('data-dark', 'true');
	await expect(viewer).toHaveClass(/dark/);
});
