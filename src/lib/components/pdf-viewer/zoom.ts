// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Framework-free zoom, rotation, download-name, and page-layout helpers.

/** Zoom modes computed from the viewport and page sizes, matching upstream. */
export type PdfViewerZoomMode = 'fit-page' | 'fit-width' | 'automatic';

/** Zoom levels accepted by the viewer, matching the upstream React prop. */
export type PdfViewerZoomLevel = number | PdfViewerZoomMode;

/** Page size in CSS pixels. */
export interface PdfLayoutSize {
	width: number;
	height: number;
}

/** Default zoom when no numeric default is given. */
export const DEFAULT_ZOOM = 1;

/** Fixed zoom steps offered by the toolbar, matching upstream. */
export const ZOOM_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

/** Minimum zoom: the smallest toolbar step. */
export const MIN_ZOOM = ZOOM_OPTIONS[0];

/** Maximum zoom: the largest toolbar step. */
export const MAX_ZOOM = ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1];

/** Zoom modes in the order the upstream toolbar lists them. */
export const ZOOM_MODES: ReadonlyArray<{ value: PdfViewerZoomMode; label: string }> = [
	{ value: 'fit-page', label: 'Fit page' },
	{ value: 'fit-width', label: 'Fit width' },
	{ value: 'automatic', label: 'Automatic' }
];

export function isZoomMode(value: unknown): value is PdfViewerZoomMode {
	return value === 'fit-page' || value === 'fit-width' || value === 'automatic';
}

/** Scroll viewport size plus the padding kept around the pages. */
export interface ZoomViewport {
	width: number;
	height: number;
	gap: number;
}

/**
 * Scale for a zoom mode, as the upstream EmbedPDF zoom plugin computes it:
 * the widest and tallest page against the viewport minus its padding.
 * Returns null until the viewport is measured and page sizes are known.
 */
export function computeFitZoom(
	mode: PdfViewerZoomMode,
	viewport: ZoomViewport,
	pageSizes: readonly PdfLayoutSize[]
): number | null {
	const availableWidth = viewport.width - 2 * viewport.gap;
	const availableHeight = viewport.height - 2 * viewport.gap;
	if (pageSizes.length === 0 || availableWidth <= 0 || availableHeight <= 0) return null;
	const maxWidth = Math.max(...pageSizes.map((size) => size.width));
	const maxHeight = Math.max(...pageSizes.map((size) => size.height));
	const fitWidth = availableWidth / maxWidth;
	if (mode === 'fit-width') return fitWidth;
	if (mode === 'fit-page') return Math.min(fitWidth, availableHeight / maxHeight);
	return Math.min(fitWidth, 1);
}

/**
 * Current scale for a zoom level: clamped and floored to three decimals like
 * upstream. A mode falls back to 100% until it can be computed.
 */
export function resolveZoom(
	level: PdfViewerZoomLevel,
	viewport: ZoomViewport,
	pageSizes: readonly PdfLayoutSize[],
	min: number = MIN_ZOOM,
	max: number = MAX_ZOOM
): number {
	const base = isZoomMode(level) ? computeFitZoom(level, viewport, pageSizes) : level;
	if (base === null || Number.isNaN(base)) return DEFAULT_ZOOM;
	return Math.floor(Math.min(max, Math.max(min, base)) * 1000) / 1000;
}

/** Zoom dropdown value: the mode, or the current scale to two decimals. */
export function zoomSelectValue(level: PdfViewerZoomLevel, zoom: number): string {
	return isZoomMode(level) ? level : String(Number(zoom.toFixed(2)));
}

/** Zoom dropdown percentages, with the current scale added when it is not a preset. */
export function zoomSelectOptions(zoom: number, presets: readonly number[] = ZOOM_OPTIONS): number[] {
	const current = Number(zoom.toFixed(2));
	return presets.includes(current)
		? [...presets]
		: [...presets, current].sort((left, right) => left - right);
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

/** EmbedPDF's default zoom-button step for each zoom range. */
const ZOOM_STEP_RANGES = [
	{ min: 0.2, max: 0.5, step: 0.05 },
	{ min: 0.5, max: 1, step: 0.1 },
	{ min: 1, max: 2, step: 0.2 },
	{ min: 2, max: 4, step: 0.4 },
	{ min: 4, max: 10, step: 0.8 }
];

/**
 * Zoom one button press in (1) or out (-1) the way the upstream editor's
 * EmbedPDF zoom plugin does: the step depends on the current zoom range.
 */
export function zoomStepByRange(current: number, direction: 1 | -1, min: number, max: number): number {
	const step =
		ZOOM_STEP_RANGES.find((range) => current >= range.min && current < range.max)?.step ?? 0.1;
	const next = Math.min(max, Math.max(min, current + direction * step));
	return Math.floor(next * 1000) / 1000;
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

/** Page size after a rotation: quarter turns swap width and height. */
export function rotatedPageSize(size: PdfLayoutSize, rotation: number): PdfLayoutSize {
	return normalizeRotation(rotation) % 180 === 0
		? { width: size.width, height: size.height }
		: { width: size.height, height: size.width };
}

/** Vertical stack of pages with `gap` around and between them. */
export interface PdfPageLayout {
	tops: number[];
	heights: number[];
	widths: number[];
	totalHeight: number;
	totalWidth: number;
}

/** Lay pages of any size out top to bottom. */
export function computePageLayout(sizes: readonly PdfLayoutSize[], gap: number): PdfPageLayout {
	if (sizes.length === 0) return { tops: [], heights: [], widths: [], totalHeight: 0, totalWidth: 0 };
	const tops: number[] = [];
	const heights: number[] = [];
	const widths: number[] = [];
	let offset = gap;
	let maxWidth = 0;
	for (const size of sizes) {
		tops.push(offset);
		heights.push(size.height);
		widths.push(size.width);
		offset += size.height + gap;
		maxWidth = Math.max(maxWidth, size.width);
	}
	return { tops, heights, widths, totalHeight: offset, totalWidth: maxWidth + 2 * gap };
}

/** Index of the last page whose top is at or above `offset` (0-based, -1 when empty). */
function indexAtOffset(layout: PdfPageLayout, offset: number): number {
	let low = 0;
	let high = layout.tops.length - 1;
	let found = high < 0 ? -1 : 0;
	while (low <= high) {
		const mid = (low + high) >> 1;
		if (layout.tops[mid]! <= offset) {
			found = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return found;
}

/** Page (1-based) at a scroll offset; 0 when there are no pages. */
export function pageAtOffset(layout: PdfPageLayout, offset: number): number {
	return indexAtOffset(layout, offset) + 1;
}

/**
 * Current page the way EmbedPDF's scroll plugin picks it: the page with the
 * largest visible share of its own area, ties going to the lower page number.
 * Pages are centred horizontally in content at least as wide as the viewport.
 * Returns 1-based, or 0 when there are no pages.
 */
export function mostVisiblePage(
	layout: PdfPageLayout,
	scrollTop: number,
	viewportHeight: number,
	scrollLeft: number,
	viewportWidth: number
): number {
	const contentWidth = Math.max(layout.totalWidth, viewportWidth);
	let best = 0;
	let bestShare = -1;
	for (let index = 0; index < layout.tops.length; index += 1) {
		const top = layout.tops[index]!;
		const height = layout.heights[index]!;
		const width = layout.widths[index]!;
		const left = (contentWidth - width) / 2;
		const visibleHeight = Math.min(top + height, scrollTop + viewportHeight) - Math.max(top, scrollTop);
		// An unmeasured viewport (width 0) counts every page as fully visible across.
		const visibleWidth =
			viewportWidth > 0
				? Math.min(left + width, scrollLeft + viewportWidth) - Math.max(left, scrollLeft)
				: width;
		if (visibleHeight <= 0 || visibleWidth <= 0 || height <= 0 || width <= 0) continue;
		const share = (visibleHeight * visibleWidth) / (height * width);
		if (share > bestShare) {
			best = index + 1;
			bestShare = share;
		}
	}
	return best || (layout.tops.length ? 1 : 0);
}

/** A document point: a page and how far down it is, as a fraction of the page height. */
export interface PageAnchor {
	index: number;
	fraction: number;
}

/** Anchor for a scroll offset, so the same point can be found after a relayout. */
export function pageAnchorAt(layout: PdfPageLayout, offset: number): PageAnchor | null {
	const index = indexAtOffset(layout, offset);
	if (index < 0) return null;
	const height = layout.heights[index]!;
	return { index, fraction: height > 0 ? (offset - layout.tops[index]!) / height : 0 };
}

/** Scroll offset of an anchored point in a (new) layout. */
export function anchorOffset(layout: PdfPageLayout, anchor: PageAnchor): number {
	return (layout.tops[anchor.index] ?? 0) + anchor.fraction * (layout.heights[anchor.index] ?? 0);
}

/** Half-open `[start, end)` page index range to render for a scroll position. */
export function pageWindow(
	layout: PdfPageLayout,
	scrollTop: number,
	viewportHeight: number,
	overscan: number
): { start: number; end: number } {
	const count = layout.tops.length;
	if (count === 0) return { start: 0, end: 0 };
	const top = Math.min(Math.max(0, scrollTop), Math.max(0, layout.totalHeight - viewportHeight));
	const first = indexAtOffset(layout, top);
	const last = indexAtOffset(layout, top + viewportHeight - 1);
	return {
		start: Math.max(0, first - overscan),
		end: Math.min(count, last + 1 + overscan)
	};
}
