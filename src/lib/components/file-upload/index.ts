// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export { default as FileUpload } from './FileUpload.svelte';
export {
	DEFAULT_ACCEPT,
	DEFAULT_ACCEPTED_FILE_TYPES,
	formatBytes,
	matchesAccept,
	toUploadItems
} from './FileUpload.svelte';
export type { AcceptedFileType, FileUploadItem } from './FileUpload.svelte';
