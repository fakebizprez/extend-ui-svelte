// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PREVIEW_COMPONENTS } from '../../routes/components';
import { BASE_URL } from '../../../scripts/llms-txt/generate';
import { generateRobotsTxt, generateSitemapXml } from '../../../scripts/seo/generate';

describe('robots.txt generator', () => {
	it('allows all crawlers and references the sitemap', () => {
		const body = generateRobotsTxt();
		expect(body).toContain('User-agent: *');
		expect(body).toMatch(/^Allow: \/$/m);
		expect(body).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`);
	});

	it('blocks no AI crawler', () => {
		const body = generateRobotsTxt();
		for (const bot of ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'CCBot']) {
			expect(body).not.toContain(bot);
		}
	});

	it('disallows test harness routes', () => {
		const body = generateRobotsTxt();
		expect(body).toContain('Disallow: /engines/');
		expect(body).toContain('Disallow: /bounding-box-citations/multi-page');
		expect(body).toContain('Disallow: /schema-builder/controlled');
	});
});

describe('sitemap.xml generator', () => {
	it('emits well-formed XML with the home page and every component', () => {
		expect(PREVIEW_COMPONENTS.length).toBeGreaterThan(0);
		const body = generateSitemapXml();
		expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(body.trimEnd().endsWith('</urlset>')).toBe(true);
		const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
		expect(locs).toContain(`${BASE_URL}/`);
		for (const { slug } of PREVIEW_COMPONENTS) {
			expect(locs).toContain(`${BASE_URL}/${slug}`);
		}
		expect(locs).toHaveLength(PREVIEW_COMPONENTS.length + 1);
		expect(new Set(locs).size).toBe(locs.length);
	});

	it('lists no harness routes', () => {
		const body = generateSitemapXml();
		expect(body).not.toContain('/engines/');
		expect(body).not.toContain('multi-page');
		expect(body).not.toContain('/controlled');
	});
});

describe('static SEO files', () => {
	it('match the generator output exactly', () => {
		expect(readFileSync('static/robots.txt', 'utf8')).toBe(generateRobotsTxt());
		expect(readFileSync('static/sitemap.xml', 'utf8')).toBe(generateSitemapXml());
	});
});
