import { expect, test } from '@playwright/test';

test('desktop shows the grouped sidebar with the current page marked', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/pdf-viewer');

	const nav = page.getByRole('navigation', { name: 'Components' });
	await expect(nav).toBeVisible();
	await expect(nav.getByRole('heading', { name: 'Viewers' })).toBeVisible();
	await expect(nav.getByRole('link', { name: 'PDF Viewer' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
});

test('phone shows a menu button that opens and closes the sidebar', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/toggle');

	const menu = page.getByRole('button', { name: 'Menu' });
	await expect(menu).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Components' })).toBeHidden();

	await menu.click();
	const nav = page.getByRole('navigation', { name: 'Components' });
	await expect(nav).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(nav).toBeHidden();
});

test('phone menu link goes to the page and closes the menu', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Menu' }).click();
	await page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: 'Group' }).click();
	await expect(page).toHaveURL(/\/group$/);
	await expect(page.getByRole('navigation', { name: 'Components' })).toBeHidden();
});

test('theme switch persists across reload', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/');
	await page.evaluate(() => localStorage.removeItem('docs-theme'));
	await page.reload();

	const html = page.locator('html');
	const before = await html.getAttribute('data-theme');
	await page.getByRole('button', { name: 'Toggle theme' }).click();
	const after = await html.getAttribute('data-theme');
	expect(after).not.toBe(before);

	await page.reload();
	await expect(html).toHaveAttribute('data-theme', after!);
});

test('previous and next links walk the sidebar order', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/file-thumbnail');

	await page.getByRole('link', { name: /^Next:/ }).click();
	await expect(page).toHaveURL(/\/file-system$/);
	await page.getByRole('link', { name: /^Previous:/ }).click();
	await expect(page).toHaveURL(/\/file-thumbnail$/);
});

test('on-this-page list shows on a wide screen for the home page', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');
	const toc = page.getByRole('navigation', { name: 'On this page' });
	await expect(toc).toBeVisible();
	await expect(toc.getByRole('link', { name: 'Install' })).toBeVisible();
});

test('home page has no sideways scroll at phone width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
