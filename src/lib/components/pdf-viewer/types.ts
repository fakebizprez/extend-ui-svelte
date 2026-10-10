// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).

/**
 * Props passed to the `pageOverlay` snippet for each rendered page.
 * Matches the upstream React `PDFViewerPageOverlayProps`.
 */
export interface PdfViewerPageOverlayProps {
	pageNumber: number;
	pageWidth: number;
	pageHeight: number;
	scale: number;
	rotation: number;
}
