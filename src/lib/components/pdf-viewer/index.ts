// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
export { default as PdfViewer, type PdfViewerProps } from './PdfViewer.svelte';
export { default } from './PdfViewer.svelte';
export type { PdfViewerPageOverlayProps } from './types.js';
export {
	clampZoom,
	computeActivePage,
	DEFAULT_ZOOM,
	ensurePdfExtension,
	formatZoomPercent,
	getPdfDownloadFileName,
	getRotatedPdfDownloadFileName,
	MAX_ZOOM,
	MIN_ZOOM,
	normalizeRotation,
	resolveInitialZoom,
	rotateClockwise,
	rotateCounterClockwise,
	ZOOM_OPTIONS,
	zoomStepIn,
	zoomStepOut,
	type PdfViewerZoomLevel
} from './zoom.js';
