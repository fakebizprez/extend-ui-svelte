// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

export { default as FileSystem } from './FileSystem.svelte';
export {
	ancestorFolderPaths,
	buildFileSystemIndex,
	flattenVisibleEntries,
	normalizeFolderPath,
	pathName,
	pathParent
} from './tree.js';
export type { FileSystemIndex, VisibleRow } from './tree.js';
export type {
	FileEntry,
	FileSystemEntry,
	FileSystemFileItem,
	FileSystemFolderItem,
	FileSystemItem,
	FolderEntry
} from './types.js';
