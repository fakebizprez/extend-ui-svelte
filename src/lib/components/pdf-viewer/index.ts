// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
export {
	default as PdfViewer,
	default as PDFViewer,
	type PdfViewerProps,
	type PdfViewerProps as PDFViewerProps
} from './PdfViewer.svelte';
export { default } from './PdfViewer.svelte';
export type {
	PdfViewerPageOverlayProps,
	PdfViewerPageOverlayProps as PDFViewerPageOverlayProps
} from './types.js';
export {
	clampZoom,
	computeFitZoom,
	computePageLayout,
	DEFAULT_ZOOM,
	ensurePdfExtension,
	formatZoomPercent,
	getPdfDownloadFileName,
	getRotatedPdfDownloadFileName,
	isZoomMode,
	MAX_ZOOM,
	MIN_ZOOM,
	normalizeRotation,
	pageAtOffset,
	pageWindow,
	resolveZoom,
	rotateClockwise,
	rotateCounterClockwise,
	rotatedPageSize,
	ZOOM_MODES,
	ZOOM_OPTIONS,
	zoomSelectOptions,
	zoomSelectValue,
	zoomStepIn,
	zoomStepOut,
	type PdfLayoutSize,
	type PdfPageLayout,
	type PdfViewerZoomLevel,
	type PdfViewerZoomLevel as PDFViewerZoomLevel,
	type PdfViewerZoomMode,
	type ZoomViewport
} from './zoom.js';
