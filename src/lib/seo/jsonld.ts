// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export const SITE_NAME = 'Extend UI Svelte';
const UPSTREAM = 'https://github.com/extend-hq/ui';

export function websiteJsonLd(url: string, description: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url,
		description,
		isBasedOn: UPSTREAM
	};
}

export function techArticleJsonLd(url: string, headline: string, description: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'TechArticle',
		headline,
		description,
		url,
		isBasedOn: UPSTREAM
	};
}

// Escape "<" so no value can close the script tag early.
export function jsonLdScript(data: object): string {
	return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
