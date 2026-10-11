// MIT License — Svelte 5 port of Extend UI pdf-editor. Upstream: extend-hq/ui (MIT).
export {
	default as PdfEditor,
	default as PDFEditor,
	type PdfEditorDocumentInfo,
	type PdfEditorProps,
	type PdfEditorProps as PDFEditorProps,
	type PdfEditorSaveResult,
	type PdfEditorZoomLevel,
	type PdfEditorZoomLevel as PDFEditorZoomLevel
} from './PdfEditor.svelte';
export { default } from './PdfEditor.svelte';
export {
	createEditState,
	deleteEditPage,
	exportEditedPdf,
	getPdfFileName,
	moveEditPage,
	resetEditState,
	rotateEditPage,
	type EditedPdfPage,
	type PdfEditState,
	type PdfRotateDirection
} from './page-model.js';
