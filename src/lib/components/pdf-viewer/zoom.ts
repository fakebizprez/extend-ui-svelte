// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Framework-free zoom, rotation, download-name, and active-page helpers.

/** Zoom levels accepted by the viewer, matching the upstream React prop. */
export type PdfViewerZoomLevel = number | 'fit-page' | 'fit-width' | 'automatic';

/** Default zoom when no numeric default is given. */
export const DEFAULT_ZOOM = 1;

/** Fixed zoom steps offered by the toolbar, matching upstream. */
export const ZOOM_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

/** Minimum zoom: the smallest toolbar step. */
export const MIN_ZOOM = ZOOM_OPTIONS[0];

/** Maximum zoom: the largest toolbar step. */
export const MAX_ZOOM = ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1];

/** Resolve a default zoom prop to a numeric scale; fit modes start at 1. */
export function resolveInitialZoom(level: PdfViewerZoomLevel | undefined): number {
	if (typeof level !== 'number' || Number.isNaN(level)) return DEFAULT_ZOOM;
	return clampZoom(level);
}

/** Clamp a scale into the toolbar step range. */
export function clampZoom(value: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

const STEP_EPSILON = 1e-9;

/** Next zoom step above the current scale; stays at the maximum. */
export function zoomStepIn(current: number): number {
	for (const option of ZOOM_OPTIONS) {
		if (option > current + STEP_EPSILON) return option;
	}
	return MAX_ZOOM;
}

/** Next zoom step below the current scale; stays at the minimum. */
export function zoomStepOut(current: number): number {
	for (let i = ZOOM_OPTIONS.length - 1; i >= 0; i -= 1) {
		if (ZOOM_OPTIONS[i] < current - STEP_EPSILON) return ZOOM_OPTIONS[i];
	}
	return MIN_ZOOM;
}

/** Format a scale as a toolbar label such as "100%". */
export function formatZoomPercent(zoom: number): string {
	return `${Math.round(zoom * 100)}%`;
}

/** Rotation in degrees, normalized to a quarter turn (0, 90, 180, 270). */
export function normalizeRotation(degrees: number): number {
	const normalized = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
	return normalized;
}

/** Rotate 90 degrees clockwise. */
export function rotateClockwise(rotation: number): number {
	return normalizeRotation(normalizeRotation(rotation) + 90);
}

/** Rotate 90 degrees counter-clockwise. */
export function rotateCounterClockwise(rotation: number): number {
	return normalizeRotation(normalizeRotation(rotation) - 90);
}

/** Append ".pdf" unless the name already ends with it (case-insensitive). */
export function ensurePdfExtension(fileName: string): string {
	return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
}

/**
 * Download file name: the explicit fileName wins, otherwise the last src
 * path segment (query and hash stripped) is used, falling back to
 * "document.pdf". Matches the upstream React helper.
 */
export function getPdfDownloadFileName(fileName: string | undefined, src: string): string {
	if (fileName?.trim()) return ensurePdfExtension(fileName.trim());

	const pathname = (src.split(/[?#]/)[0] ?? '').trim();
	const rawName = pathname.split('/').pop() || 'document.pdf';

	try {
		return ensurePdfExtension(decodeURIComponent(rawName));
	} catch {
		return ensurePdfExtension(rawName);
	}
}

/** Mark a download name as rotated, e.g. "bank.pdf" becomes "bank-rotated.pdf". */
export function getRotatedPdfDownloadFileName(fileName: string): string {
	return fileName.replace(/\.pdf$/i, '-rotated.pdf');
}

/**
 * Active (topmost visible) page for a scroll offset, 1-based. Returns 0 when
 * no document is loaded.
 */
export function computeActivePage(
	scrollTop: number,
	slotHeight: number,
	pageCount: number
): number {
	if (pageCount <= 0) return 0;
	if (!(slotHeight > 0)) return 1;
	const page = Math.floor(scrollTop / slotHeight) + 1;
	return Math.min(pageCount, Math.max(1, page));
}
