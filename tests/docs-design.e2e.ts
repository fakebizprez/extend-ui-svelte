import { expect, test } from '@playwright/test';

// Docs shell follows the Linehaul design system: cream paper, hairline borders,
// square corners, Space Grotesk display plus Space Mono body.
const style = (page: import('@playwright/test').Page, selector: string, prop: string) =>
	page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test.beforeEach(async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => localStorage.setItem('docs-theme', 'light'));
});

test('page paper is cream and body text is warm black', async ({ page }) => {
	await page.goto('/');
	expect(await style(page, 'body', 'background-color')).toBe('rgb(247, 247, 243)');
	expect(await style(page, 'body', 'color')).toBe('rgb(26, 26, 24)');
});

test('loads Space Grotesk and Space Mono from Google Fonts', async ({ page }) => {
	await page.goto('/');
	const href = await page.locator('link[rel="stylesheet"][href*="fonts.googleapis.com"]').first().getAttribute('href');
	expect(href).toContain('Space+Grotesk');
	expect(href).toContain('Space+Mono');
});

test('brand and headings use the display face, uppercase at hero scale', async ({ page }) => {
	await page.goto('/');
	expect(await style(page, 'header .brand', 'font-family')).toContain('Space Grotesk');
	expect(await style(page, 'h1', 'font-family')).toContain('Space Grotesk');
	expect(await style(page, 'h1', 'text-transform')).toBe('uppercase');
});

test('body copy and sidebar links use the mono face', async ({ page }) => {
	await page.goto('/');
	expect(await style(page, 'article p', 'font-family')).toContain('Space Mono');
	expect(await style(page, 'nav[aria-label="Components"] a', 'font-family')).toContain('Space Mono');
});

test('controls and cards have square corners and no shadows', async ({ page }) => {
	await page.goto('/toggle');
	for (const sel of [
		'button[aria-label="Toggle theme"]',
		'nav[aria-label="Components"] a[aria-current="page"]',
		'a:has-text("Previous")'
	]) {
		expect(await style(page, sel, 'border-radius'), sel).toBe('0px');
		expect(await style(page, sel, 'box-shadow'), sel).toBe('none');
	}
	await page.goto('/');
	expect(await style(page, '.home-card', 'border-radius')).toBe('0px');
	expect(await style(page, '.home-card', 'background-color')).toBe('rgb(255, 255, 255)');
	expect(await style(page, '.home-card', 'box-shadow')).toBe('none');
});

test('links and the current-page marker use the signal blue', async ({ page }) => {
	await page.goto('/toggle');
	expect(await style(page, 'nav[aria-label="Components"] a[aria-current="page"]', 'color')).toBe(
		'rgb(0, 119, 255)'
	);
});

test('muted text keeps AA contrast on cream (never the light tertiary grey)', async ({ page }) => {
	await page.goto('/toggle');
	expect(await style(page, '.crumbs', 'color')).toBe('rgb(82, 82, 74)');
});

test('dark theme uses the warm inverted surfaces', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Toggle theme' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await style(page, 'body', 'background-color')).toBe('rgb(12, 12, 10)');
	expect(await style(page, 'body', 'color')).toBe('rgb(247, 247, 243)');
});
