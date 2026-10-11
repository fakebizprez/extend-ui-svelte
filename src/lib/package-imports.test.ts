// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// The published package ships dist/ only, and svelte-package keeps import
// specifiers as written. A `#lib/...` import maps to ./src/lib (not published),
// so library code must import its own files with relative paths.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

function libraryFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) return libraryFiles(full);
		const isSource = /\.(svelte|ts|js)$/.test(full);
		const isTest = /\.(test|spec)\.|Harness\.svelte$/.test(full);
		return isSource && !isTest ? [full] : [];
	});
}

describe('published package', () => {
	it('library code never imports through the #lib alias', () => {
		const offenders = libraryFiles('src/lib').filter((file) =>
			/(from\s+|import\(\s*)['"]#lib/.test(readFileSync(file, 'utf8'))
		);
		expect(offenders).toEqual([]);
	});

	it('library code imports relative files with their extension (strict ESM)', () => {
		const extensionless = libraryFiles('src/lib').flatMap((file) =>
			[...readFileSync(file, 'utf8').matchAll(/(?:from\s+|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)]
				.map((match) => match[1])
				.filter((specifier) => !/\.(js|svelte|json|css)$/.test(specifier) && !specifier.includes('?'))
				.map((specifier) => `${file}: ${specifier}`)
		);
		expect(extensionless).toEqual([]);
	});

	it('exposes each component folder as a package subpath', () => {
		const exports = packageJson.exports as Record<string, unknown>;
		expect(exports['./components/*']).toEqual({
			types: './dist/components/*/index.d.ts',
			svelte: './dist/components/*/index.js'
		});
	});
});
