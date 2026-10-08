// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
export {
	default as PdfEditor,
	type PdfEditorProps,
	type PdfEditorSaveResult,
	type PdfEditorZoomLevel
} from './PdfEditor.svelte';
export { default } from './PdfEditor.svelte';
export {
	createEditState,
	deleteEditPage,
	exportEditedPdf,
	moveEditPage,
	resetEditState,
	rotateEditPage,
	type EditedPdfPage,
	type PdfEditState,
	type PdfRotateDirection
} from './page-model.js';
