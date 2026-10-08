// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

import type {
	FileEntry,
	FileSystemEntry,
	FileSystemItem,
	FolderEntry
} from './types.js';

/**
 * Framework-free helpers that turn the flat upstream manifest into a folder
 * hierarchy. Folders are optional in `items`; missing prefixes are inferred
 * from file paths, matching the React component.
 */

export interface FileSystemIndex {
	children: Map<string, FileSystemEntry[]>;
	files: Map<string, FileEntry>;
	folders: Map<string, FolderEntry>;
}

export interface VisibleRow {
	entry: FileSystemEntry;
	depth: number;
}

export function normalizeFolderPath(path: string): string {
	if (!path || path === '/') return '';
	return path.endsWith('/') ? path : `${path}/`;
}

export function pathName(path: string): string {
	const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
	const separatorIndex = trimmed.lastIndexOf('/');
	return separatorIndex === -1 ? trimmed : trimmed.slice(separatorIndex + 1);
}

export function pathParent(path: string): string {
	const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
	const separatorIndex = trimmed.lastIndexOf('/');
	return separatorIndex === -1 ? '' : trimmed.slice(0, separatorIndex + 1);
}

/** Every ancestor folder prefix of `folderPath`, root-first, including itself. */
export function ancestorFolderPaths(folderPath: string): string[] {
	const normalized = normalizeFolderPath(folderPath);
	if (!normalized) return [];
	const segments = normalized.split('/').filter(Boolean);
	return segments.map((_, index) => `${segments.slice(0, index + 1).join('/')}/`);
}

function compareEntries(a: FileSystemEntry, b: FileSystemEntry): number {
	if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
	return a.name.localeCompare(b.name);
}

export function buildFileSystemIndex(items: FileSystemItem[]): FileSystemIndex {
	const children = new Map<string, FileSystemEntry[]>();
	const files = new Map<string, FileEntry>();
	const folders = new Map<string, FolderEntry>();

	function childList(parentPath: string): FileSystemEntry[] {
		let list = children.get(parentPath);
		if (!list) {
			list = [];
			children.set(parentPath, list);
		}
		return list;
	}

	function ensureFolder(folderPath: string): FolderEntry {
		const normalized = normalizeFolderPath(folderPath);
		const existing = folders.get(normalized);
		if (existing) return existing;
		const entry: FolderEntry = {
			kind: 'folder',
			path: normalized,
			name: pathName(normalized),
			parentPath: pathParent(normalized)
		};
		folders.set(normalized, entry);
		childList(entry.parentPath).push(entry);
		return entry;
	}

	for (const item of items) {
		if (item.kind === 'folder') {
			const normalized = normalizeFolderPath(item.path);
			const parentPath = item.parentPath ?? pathParent(normalized);
			// Ensure ancestors first so inferred parents always exist.
			for (const ancestor of ancestorFolderPaths(parentPath)) ensureFolder(ancestor);
			const entry: FolderEntry = {
				...item,
				path: normalized,
				name: item.name ?? pathName(normalized),
				parentPath
			};
			const previous = folders.get(normalized);
			if (previous) {
				const siblings = childList(previous.parentPath);
				const at = siblings.indexOf(previous);
				if (at !== -1) siblings.splice(at, 1);
			}
			folders.set(normalized, entry);
			childList(parentPath).push(entry);
		} else {
			const parentPath = item.parentPath ?? pathParent(item.path);
			for (const ancestor of ancestorFolderPaths(parentPath)) ensureFolder(ancestor);
			const entry: FileEntry = {
				...item,
				key: item.key ?? item.path,
				name: item.name ?? pathName(item.path),
				parentPath
			};
			files.set(item.path, entry);
			childList(parentPath).push(entry);
		}
	}

	for (const list of children.values()) list.sort(compareEntries);
	return { children, files, folders };
}

export function flattenVisibleEntries(
	index: FileSystemIndex,
	expanded: ReadonlySet<string>
): VisibleRow[] {
	const rows: VisibleRow[] = [];
	function visit(parentPath: string, depth: number): void {
		for (const entry of index.children.get(parentPath) ?? []) {
			rows.push({ entry, depth });
			if (entry.kind === 'folder' && expanded.has(entry.path)) {
				visit(entry.path, depth + 1);
			}
		}
	}
	visit('', 0);
	return rows;
}
