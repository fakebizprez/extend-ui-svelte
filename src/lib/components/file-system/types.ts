// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).

/**
 * Flat file/folder manifest types for the file-system tree browser.
 * Prop and field names match the upstream React component.
 */

export type FileSystemFolderItem = {
	kind: 'folder';
	/** Folder prefix, e.g. `"invoices/2026/"`. A trailing slash is added when missing. */
	path: string;
	name?: string;
	parentPath?: string;
	/** Set when children exist but are not in `items` yet; enables lazy loading. */
	hasChildren?: boolean;
	createdAt?: string;
	updatedAt?: string;
};

export type FileSystemFileItem = {
	kind: 'file';
	/** Display/canonical path, e.g. `"invoices/2026/jan.pdf"`. */
	path: string;
	/** Original object key (S3/R2). Defaults to `path`. */
	key?: string;
	name?: string;
	parentPath?: string;
	contentType?: string;
	size?: number;
	createdAt?: string;
	updatedAt?: string;
	etag?: string;
	/** Optional if already public/presigned. */
	url?: string;
	metadata?: Record<string, string>;
};

export type FileSystemItem = FileSystemFolderItem | FileSystemFileItem;

/** Normalized folder entry: derived fields are always filled in. */
export type FolderEntry = FileSystemFolderItem & {
	name: string;
	parentPath: string;
};

/** Normalized file entry: derived fields are always filled in. */
export type FileEntry = FileSystemFileItem & {
	key: string;
	name: string;
	parentPath: string;
};

export type FileSystemEntry = FolderEntry | FileEntry;
