// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import {
	buildFileSystemIndex,
	flattenVisibleEntries,
	normalizeFolderPath,
	pathName,
	pathParent
} from './tree.js';
import type { FileSystemItem } from './types.js';

const ITEMS: FileSystemItem[] = [
	{ kind: 'file', path: 'invoices/2026/jan.pdf', contentType: 'application/pdf' },
	{ kind: 'folder', path: 'invoices/2026/', name: 'Archive 2026' },
	{ kind: 'file', path: 'readme.txt' }
];

describe('normalizeFolderPath', () => {
	it('adds a missing trailing slash', () => {
		expect(normalizeFolderPath('invoices/2026')).toBe('invoices/2026/');
	});

	it('keeps an existing trailing slash', () => {
		expect(normalizeFolderPath('invoices/')).toBe('invoices/');
	});

	it('maps empty and root paths to the root prefix', () => {
		expect(normalizeFolderPath('')).toBe('');
		expect(normalizeFolderPath('/')).toBe('');
	});
});

describe('pathName', () => {
	it('returns the last segment of a file path', () => {
		expect(pathName('invoices/2026/jan.pdf')).toBe('jan.pdf');
	});

	it('returns the last segment of a folder path', () => {
		expect(pathName('invoices/2026/')).toBe('2026');
	});

	it('returns a bare name unchanged', () => {
		expect(pathName('readme.txt')).toBe('readme.txt');
	});
});

describe('pathParent', () => {
	it('returns the parent prefix of a nested file', () => {
		expect(pathParent('invoices/2026/jan.pdf')).toBe('invoices/2026/');
	});

	it('returns the parent prefix of a nested folder', () => {
		expect(pathParent('invoices/2026/')).toBe('invoices/');
	});

	it('returns the root prefix for top-level entries', () => {
		expect(pathParent('readme.txt')).toBe('');
		expect(pathParent('invoices/')).toBe('');
	});
});

describe('buildFileSystemIndex', () => {
	it('infers missing folder prefixes from file paths', () => {
		const index = buildFileSystemIndex(ITEMS);

		expect(index.folders.has('invoices/')).toBe(true);
		expect(index.folders.get('invoices/')?.name).toBe('invoices');
		expect(index.folders.get('invoices/2026/')?.name).toBe('Archive 2026');
	});

	it('groups children by parent prefix with folders first, then alphabetical', () => {
		const index = buildFileSystemIndex(ITEMS);
		const root = index.children.get('') ?? [];

		expect(root.map((entry) => entry.name)).toEqual(['invoices', 'readme.txt']);
		expect(root[0]?.kind).toBe('folder');
	});

	it('keys files by path and defaults the key to the path', () => {
		const index = buildFileSystemIndex(ITEMS);
		const file = index.files.get('invoices/2026/jan.pdf');

		expect(file?.name).toBe('jan.pdf');
		expect(file?.key).toBe('invoices/2026/jan.pdf');
		expect(file?.parentPath).toBe('invoices/2026/');
	});

	it('respects an explicit key, name, and parentPath', () => {
		const index = buildFileSystemIndex([
			{
				kind: 'file',
				path: 'a.pdf',
				key: 'object-store-key',
				name: 'Display.pdf',
				parentPath: 'custom/'
			}
		]);
		const file = index.files.get('a.pdf');

		expect(file?.key).toBe('object-store-key');
		expect(file?.name).toBe('Display.pdf');
		expect(file?.parentPath).toBe('custom/');
	});
});

describe('flattenVisibleEntries', () => {
	it('returns only root entries when nothing is expanded', () => {
		const index = buildFileSystemIndex(ITEMS);
		const visible = flattenVisibleEntries(index, new Set());

		expect(visible.map((row) => row.entry.path)).toEqual(['invoices/', 'readme.txt']);
		expect(visible.map((row) => row.depth)).toEqual([0, 0]);
	});

	it('includes descendants of expanded folders with depth', () => {
		const index = buildFileSystemIndex(ITEMS);
		const visible = flattenVisibleEntries(index, new Set(['invoices/']));

		expect(visible.map((row) => row.entry.path)).toEqual([
			'invoices/',
			'invoices/2026/',
			'readme.txt'
		]);
		expect(visible.map((row) => row.depth)).toEqual([0, 1, 0]);
	});
});
