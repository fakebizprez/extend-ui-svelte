// MIT License — Svelte 5 port of Extend UI docx-viewer. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type DocxViewer from './DocxViewer.svelte';

export { default as DocxViewer } from './DocxViewer.svelte';
export { default } from './DocxViewer.svelte';
export {
	DEFAULT_ZOOM,
	DOCX_MIME_TYPE,
	DOCX_UPLOAD_ACCEPT,
	ensureDocxExtension,
	formatDocumentName,
	stepZoom,
	THUMBNAIL_ITEM_HEIGHT,
	ZOOM_OPTIONS
} from './DocxViewer.svelte';
export type { DocxViewerPage } from './DocxViewer.svelte';
export type DocxViewerProps = ComponentProps<typeof DocxViewer>;
