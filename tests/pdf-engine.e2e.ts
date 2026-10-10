// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('pdf engine renders the fixture with the correct page count', async ({ page }) => {
	await page.goto('/engines/pdf');

	await expect(page.getByTestId('pdf-page-count')).toContainText('3', { timeout: 30000 });
	await expect(page.getByTestId('pdf-current-page')).toContainText('1');
	await expect(page.getByTestId('pdf-canvas')).toBeVisible();
});

test('pdf engine harness navigates pages and fires page-change events', async ({ page }) => {
	await page.goto('/engines/pdf');

	await expect(page.getByTestId('pdf-page-count')).toContainText('3', { timeout: 30000 });

	await page.getByTestId('pdf-next').click();
	await expect(page.getByTestId('pdf-current-page')).toContainText('2');

	await page.getByTestId('pdf-prev').click();
	await expect(page.getByTestId('pdf-current-page')).toContainText('1');
});
