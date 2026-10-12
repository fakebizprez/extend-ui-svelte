// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PREVIEW_COMPONENTS } from '../../routes/components';
import { NAV_GROUPS } from '../../routes/_shell/nav';
import {
	BASE_URL,
	countEntries,
	generateLlmsFullTxt,
	generateLlmsTxt
} from '../../../scripts/llms-txt/generate';
import { validateLlmsTxt } from '../../../scripts/llms-txt/validate';

const VALID_DOC = `# Example Site

> A short factual description of the example site.

## Docs

- [Home](https://example.com/): The landing page with install instructions.
- [Guide](https://example.com/guide): A guide covering setup and usage.

## Key Facts

- Founded in 2024.

## Contact

- Website: https://example.com
`;

describe('llms.txt validator', () => {
	it('accepts a well-formed document', () => {
		expect(validateLlmsTxt(VALID_DOC)).toEqual([]);
	});

	it('requires an H1 title on the first line', () => {
		const errors = validateLlmsTxt(VALID_DOC.replace('# Example Site\n', ''));
		expect(errors.some((e) => e.includes('H1'))).toBe(true);
	});

	it('requires a blockquote description under 200 characters', () => {
		const missing = validateLlmsTxt(VALID_DOC.replace(/> .*\n/, ''));
		expect(missing.some((e) => e.includes('description'))).toBe(true);
		const long = validateLlmsTxt(VALID_DOC.replace(/> .*/, `> ${'x'.repeat(201)}`));
		expect(long.some((e) => e.includes('200'))).toBe(true);
	});

	it('requires at least one H2 section', () => {
		const errors = validateLlmsTxt('# Title\n\n> Description.\n');
		expect(errors.some((e) => e.includes('H2'))).toBe(true);
	});

	it('requires absolute URLs on every entry', () => {
		const errors = validateLlmsTxt(
			VALID_DOC.replace('https://example.com/guide', '/guide')
		);
		expect(errors.some((e) => e.includes('/guide'))).toBe(true);
	});

	it('requires a description after every entry link', () => {
		const errors = validateLlmsTxt(
			VALID_DOC.replace(': A guide covering setup and usage.', '')
		);
		expect(errors.some((e) => e.includes('Guide'))).toBe(true);
	});
});

describe('llms.txt generator', () => {
	it('emits documents that validate cleanly', () => {
		expect(validateLlmsTxt(generateLlmsTxt())).toEqual([]);
		expect(validateLlmsTxt(generateLlmsFullTxt())).toEqual([]);
	});

	it('links the home page and every preview component with absolute URLs', () => {
		expect(PREVIEW_COMPONENTS.length).toBeGreaterThan(0);
		const body = generateLlmsTxt();
		expect(body).toContain(`[Extend UI Svelte](${BASE_URL}/)`);
		for (const { slug, title } of PREVIEW_COMPONENTS) {
			expect(body).toContain(`[${title}](${BASE_URL}/${slug})`);
		}
	});

	it('groups entries under every nav group heading', () => {
		expect(NAV_GROUPS.length).toBeGreaterThan(0);
		const body = generateLlmsTxt();
		for (const group of NAV_GROUPS) {
			expect(body).toContain(`## ${group.title}`);
		}
	});

	it('keeps the short file concise and the full file deeper', () => {
		const shortCount = countEntries(generateLlmsTxt());
		expect(shortCount).toBeGreaterThanOrEqual(10);
		expect(shortCount).toBeLessThanOrEqual(30);
		expect(countEntries(generateLlmsFullTxt())).toBeGreaterThan(shortCount);
	});

	it('includes Key Facts and Contact sections in both files', () => {
		for (const body of [generateLlmsTxt(), generateLlmsFullTxt()]) {
			expect(body).toContain('## Key Facts');
			expect(body).toContain('## Contact');
			expect(body).toContain('extend-hq/ui');
		}
	});
});

describe('static llms.txt files', () => {
	it('matches the generator output exactly', () => {
		expect(readFileSync('static/llms.txt', 'utf8')).toBe(generateLlmsTxt());
		expect(readFileSync('static/llms-full.txt', 'utf8')).toBe(generateLlmsFullTxt());
	});

	it('serves files that validate cleanly', () => {
		expect(validateLlmsTxt(readFileSync('static/llms.txt', 'utf8'))).toEqual([]);
		expect(validateLlmsTxt(readFileSync('static/llms-full.txt', 'utf8'))).toEqual([]);
	});
});
