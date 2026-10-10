// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { expect, test } from '@playwright/test';

test('selects an item and skips disabled ones', async ({ page }) => {
	await page.goto('/document-viewer-sidebar', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	const nav = page.getByRole('navigation', { name: 'Document viewer' });
	await expect(nav.getByRole('button', { name: 'Thumbnails' })).toHaveAttribute('aria-current', 'true');

	await nav.getByRole('button', { name: 'Search' }).click();
	await expect(nav.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'true');
	await expect(page.locator('main, body').getByText('Active item: search')).toBeVisible();

	await expect(nav.getByRole('button', { name: 'Annotate' })).toBeDisabled();
});

test('collapses and expands', async ({ page }) => {
	await page.goto('/document-viewer-sidebar', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	const sidebar = page.getByTestId('document-viewer-sidebar');
	await page.getByRole('button', { name: 'Collapse sidebar' }).click();
	await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
	await expect(page.getByRole('navigation', { name: 'Document viewer' })).toHaveCount(0);

	await page.getByRole('button', { name: 'Expand sidebar' }).click();
	await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
});

test('dark mode toggle updates the parent', async ({ page }) => {
	await page.goto('/document-viewer-sidebar', { waitUntil: 'networkidle' }); // let the page hydrate before interacting

	await page.getByRole('button', { name: 'Switch to dark mode' }).click();
	await expect(page.getByTestId('document-viewer-sidebar')).toHaveAttribute('data-theme', 'dark');
	await expect(page.getByText('Dark mode: true')).toBeVisible();
});
