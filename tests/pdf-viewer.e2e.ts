// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('pdf viewer renders the fixture page count', async ({ page }) => {
	await page.goto('/pdf-viewer');

	const indicator = page.getByTestId('pdf-page-indicator').first();
	await expect(indicator).toContainText('Page 1 of 3', { timeout: 30000 });
	await expect(page.getByTestId('pdf-viewport').first()).toBeVisible();
	await expect(page.getByTestId('pdf-page').first()).toBeVisible();
});

test('pdf viewer zoom control changes state', async ({ page }) => {
	await page.goto('/pdf-viewer');

	await expect(page.getByTestId('pdf-page-indicator').first()).toContainText('Page 1 of 3', {
		timeout: 30000
	});

	const viewer = page.getByTestId('pdf-viewer').first();
	await expect(viewer.getByTestId('pdf-zoom-label')).toContainText('100%');

	await viewer.getByRole('button', { name: 'Zoom in' }).click();
	await expect(viewer.getByTestId('pdf-zoom-label')).toContainText('125%');

	await viewer.getByRole('button', { name: 'Zoom out' }).click();
	await viewer.getByRole('button', { name: 'Zoom out' }).click();
	await expect(viewer.getByTestId('pdf-zoom-label')).toContainText('75%');
});

test('pdf viewer navigates pages and rotates', async ({ page }) => {
	await page.goto('/pdf-viewer');

	const viewer = page.getByTestId('pdf-viewer').first();
	await expect(viewer.getByTestId('pdf-page-indicator')).toContainText('Page 1 of 3', {
		timeout: 30000
	});

	await viewer.getByRole('button', { name: 'Next page' }).click();
	await expect(viewer.getByTestId('pdf-page-indicator')).toContainText('Page 2 of 3');

	await viewer.getByRole('button', { name: 'Rotate clockwise' }).click();
	await expect(viewer).toHaveAttribute('data-rotation', '90');
});
