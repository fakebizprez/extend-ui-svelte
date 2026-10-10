import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import registry from '../../registry.json';
import packageJson from '../../package.json';

const EXPECTED_COMPONENTS = [
	'file-upload',
	'csv-tsv-viewer',
	'document-viewer-sidebar',
	'file-thumbnail',
	'pdf-viewer',
	'docx-viewer',
	'xlsx-viewer',
	'pptx-viewer',
	'pdf-editor',
	'docx-editor',
	'xlsx-editor',
	'file-system',
	'document-splits',
	'schema-builder',
	'layout-blocks',
	'bounding-box-citations',
	'e-signature',
	'group',
	'color-picker',
	'toggle'
];

// Shared registry items that components depend on via `registryDependencies`.
const EXPECTED_SHARED = ['dark-mode', 'utils', 'virtual-list', 'engines'];

interface RegistryFile {
	path: string;
	type: string;
}

interface RegistryItem {
	name: string;
	files: RegistryFile[];
	registryDependencies?: string[];
	dependencies?: string[];
}

const items = registry.items as RegistryItem[];

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry).replace(/\\/g, '/');
		if (statSync(full).isDirectory()) {
			out.push(...sourceFiles(full));
		} else if (
			(full.endsWith('.svelte') || full.endsWith('.ts')) &&
			!full.endsWith('.test.ts') &&
			!full.endsWith('.spec.ts') &&
			!full.endsWith('Harness.svelte')
		) {
			out.push(full);
		}
	}
	return out;
}

describe('registry.json', () => {
	it('lists every component exactly once', () => {
		const names = items.map((item) => item.name);
		for (const name of EXPECTED_COMPONENTS) {
			expect(names.filter((n) => n === name)).toHaveLength(1);
		}
	});

	it('lists every shared dependency item', () => {
		const names = items.map((item) => item.name);
		for (const name of EXPECTED_SHARED) {
			expect(names).toContain(name);
		}
	});

	it('lists only real file paths that exist on disk', () => {
		for (const item of items) {
			expect(item.files.length).toBeGreaterThan(0);
			for (const file of item.files) {
				expect(existsSync(file.path)).toBe(true);
			}
		}
	});

	it('covers every runtime source file exactly once', () => {
		const expected = new Set([
			...sourceFiles('src/lib/components'),
			...sourceFiles('src/lib/engines'),
			...sourceFiles('src/lib/virtual-list'),
			'src/lib/dark-mode.ts',
			'src/lib/utils.ts'
		]);
		const listed = items.flatMap((item) => item.files.map((file) => file.path));
		expect(new Set(listed).size).toBe(listed.length);
		expect(new Set(listed)).toEqual(expected);
	});

	it('resolves every registryDependency to another registry item', () => {
		const names = new Set(items.map((item) => item.name));
		for (const item of items) {
			for (const dep of item.registryDependencies ?? []) {
				expect(names.has(dep)).toBe(true);
			}
		}
	});

	it('lists only dependencies present in package.json', () => {
		const available = new Set([
			...Object.keys(packageJson.dependencies ?? {}),
			...Object.keys(packageJson.peerDependencies ?? {})
		]);
		for (const item of items) {
			for (const dep of item.dependencies ?? []) {
				// shadcn registries pin "name@version"; accept a bare name too.
				const name = dep.includes('@', 1) ? dep.slice(0, dep.lastIndexOf('@')) : dep;
				expect(available.has(name)).toBe(true);
			}
		}
	});
});
