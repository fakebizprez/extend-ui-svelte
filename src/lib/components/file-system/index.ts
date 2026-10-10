// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type FileSystem from './FileSystem.svelte';

export { default as FileSystem } from './FileSystem.svelte';
export type FileSystemProps = ComponentProps<typeof FileSystem>;
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
