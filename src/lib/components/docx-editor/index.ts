// MIT License — Svelte 5 port of Extend UI docx-editor. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type DocxEditor from './DocxEditor.svelte';

export { default as DocxEditor } from './DocxEditor.svelte';
/** Upstream React export name. */
export { default as DocxEditorPreview } from './DocxEditor.svelte';
export { default } from './DocxEditor.svelte';
export {
	blocksToEditorHtml,
	DEFAULT_ZOOM_SCALE,
	DOCX_UPLOAD_ACCEPT,
	elementToBlocks,
	ensureDocxExtension,
	formatDocumentName,
	normalizeZoomScale,
	ZOOM_OPTIONS
} from './DocxEditor.svelte';
export {
	blocksToDocumentXml,
	buildDocxParts,
	DOCX_MIME_TYPE,
	escapeXml,
	exportDocxBytes
} from './export.js';
export type { DocxEditorBlock, DocxEditorBlockType, DocxEditorRun } from './export.js';
export type DocxEditorProps = ComponentProps<typeof DocxEditor>;
