import { expect, test } from '@playwright/test';
import { PREVIEW_COMPONENTS } from '../src/routes/components';

const SITE = 'https://extend-ui-svelte.linehaul.ai';

test('/robots.txt allows crawlers and points at the sitemap', async ({ request }) => {
	const response = await request.get('/robots.txt');
	expect(response.ok()).toBe(true);
	const body = await response.text();
	expect(body).toContain('User-agent: *');
	expect(body).toContain('Allow: /');
	expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
	expect(body).toContain('Disallow: /engines/');
});

test('/sitemap.xml lists the home page and every component', async ({ request }) => {
	expect(PREVIEW_COMPONENTS.length).toBeGreaterThan(0);
	const response = await request.get('/sitemap.xml');
	expect(response.ok()).toBe(true);
	const body = await response.text();
	expect(body).toContain('<urlset');
	expect(body).toContain(`${SITE}/</loc>`);
	for (const { slug } of PREVIEW_COMPONENTS) {
		expect(body).toContain(`${SITE}/${slug}</loc>`);
	}
});

test('every sitemap URL resolves', async ({ request }) => {
	const body = await (await request.get('/sitemap.xml')).text();
	const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
	expect(locs.length).toBeGreaterThan(0);
	for (const url of locs) {
		const local = url.replace(SITE, '');
		const response = await request.get(local || '/');
		expect(response.ok(), `${url} resolves`).toBe(true);
	}
});

test('home page exposes SEO head tags', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('Extend UI Svelte');
	await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		'Extend UI Svelte'
	);
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /\/$/);
});

test('component page exposes description and self-referencing canonical', async ({ page }) => {
	await page.goto('/pdf-viewer');
	await expect(page).toHaveTitle('PDF Viewer | Extend UI Svelte');
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		'content',
		/Virtualized PDF pages with zoom, search, and text selection\./
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/pdf-viewer$/);
	await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
		'content',
		/.+/
	);
});
