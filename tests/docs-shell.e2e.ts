import { expect, test } from '@playwright/test';

test('document title identifies the home page and updates after navigation', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('Extend UI Svelte');
	await page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: 'Toggle', exact: true }).click();
	await expect(page).toHaveTitle('Toggle | Extend UI Svelte');
});

test('active navigation text meets AA contrast in both themes', async ({ page }) => {
	await page.goto('/toggle');
	for (const theme of ['light', 'dark']) {
		await page.evaluate((theme) => document.documentElement.dataset.theme = theme, theme);
		const contrast = await page.getByRole('navigation', { name: 'Components' })
			.getByRole('link', { name: 'Toggle', exact: true }).evaluate((el) => {
				const luminance = (color: string) => {
					const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
						const value = channel / 255;
						return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
					});
					return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
				};
				const style = getComputedStyle(el);
				const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b);
				return (values[1] + 0.05) / (values[0] + 0.05);
			});
		expect(contrast, theme).toBeGreaterThanOrEqual(4.5);
	}
});

test('keyboard users can skip navigation and stay inside the phone menu', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.goto('/');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('main')).toBeFocused();
	const menu = page.getByRole('button', { name: 'Menu' });
	await menu.click();
	const dialog = page.getByRole('dialog', { name: 'Component navigation' });
	await expect(dialog.getByRole('button', { name: 'Close menu' })).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(menu).toBeFocused();
	expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

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

test('home keeps installation guidance and the sidebar without a second component directory', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/');
	await expect(page.getByRole('navigation', { name: 'Components' })).toBeVisible();
	await expect(page.getByRole('main').getByRole('heading', { name: 'Components' })).toHaveCount(0);
	await expect(page.getByRole('main').getByRole('heading', { name: 'Install' })).toBeVisible();
});

test('all CSV demos follow the saved site theme, theme changes and reload', async ({ page }) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem('docs-theme')) localStorage.setItem('docs-theme', 'dark');
	});
	await page.goto('/csv-tsv-viewer');
	const previews = page.getByTestId('csv-tsv-viewer');
	await expect(previews).toHaveCount(4);
	for (const preview of await previews.all()) await expect(preview).toHaveAttribute('data-dark', 'true');
	await page.getByRole('button', { name: 'Toggle theme' }).click();
	for (const preview of await previews.all()) await expect(preview).toHaveAttribute('data-dark', 'false');
	await page.reload();
	for (const preview of await previews.all()) await expect(preview).toHaveAttribute('data-dark', 'false');
});
