// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { jsonLdScript, techArticleJsonLd, websiteJsonLd } from './jsonld';

describe('JSON-LD builders', () => {
	it('describes the home page as a WebSite', () => {
		const data = websiteJsonLd('https://example.test/', 'desc');
		expect(data['@type']).toBe('WebSite');
		expect(data.name).toBe('Extend UI Svelte');
		expect(data.url).toBe('https://example.test/');
	});

	it('describes a component page as a TechArticle', () => {
		const data = techArticleJsonLd('https://example.test/pdf-viewer', 'PDF Viewer', 'desc');
		expect(data['@type']).toBe('TechArticle');
		expect(data.headline).toBe('PDF Viewer');
	});
});

describe('jsonLdScript', () => {
	it('wraps the data in a ld+json script that parses back', () => {
		const html = jsonLdScript(websiteJsonLd('https://example.test/', 'desc'));
		const body = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
		expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
		expect(JSON.parse(body)['@type']).toBe('WebSite');
	});

	it('never lets a value close the script tag', () => {
		const html = jsonLdScript(techArticleJsonLd('https://example.test/x', '</script><b>', 'd'));
		expect(html.match(/<\/script>/g)).toHaveLength(1);
	});
});
