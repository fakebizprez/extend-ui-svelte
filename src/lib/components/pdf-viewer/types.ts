// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).

/**
 * Props passed to the `pageOverlay` snippet for each rendered page.
 * Matches the upstream React `PDFViewerPageOverlayProps`.
 */
export interface PdfViewerPageOverlayProps {
	pageNumber: number;
	/** Unrotated page width at scale 1; the overlay is laid out in this page space. */
	pageWidth: number;
	/** Unrotated page height at scale 1. */
	pageHeight: number;
	scale: number;
	/** Rotation in degrees; the overlay layer is turned with the page by this much. */
	rotation: number;
}
