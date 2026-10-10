// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// PDF thumbnail helper for FileThumbnail: measure-then-render orchestration on
// top of the shared PDF engine wrapper. Only the requested page is rendered,
// never the whole document.
import type { PdfEngine, PdfSource } from '#lib/engines/pdf/index.js';

/** Default 1-based page rendered when the caller passes no page number. */
export const DEFAULT_THUMBNAIL_PAGE = 1;

/** Default target CSS width in pixels (matches the upstream docs preview). */
export const DEFAULT_THUMBNAIL_WIDTH = 240;

export interface PdfThumbnailRenderOptions {
	/** 1-based page number. Defaults to 1; clamped into the loaded document. */
	pageNumber?: number;
	/** Target CSS width in pixels. Defaults to 240. */
	width?: number;
	/** Device pixel ratio applied to the backing store. Defaults to 1. */
	dpr?: number;
}

export interface PdfThumbnailRenderResult {
	/** Pages in the loaded document. */
	pageCount: number;
	/** Clamped 1-based page that was actually rendered. */
	pageNumber: number;
	/** Rendered CSS width in pixels. */
	width: number;
	/** Rendered CSS height in pixels, preserving the page aspect ratio. */
	height: number;
}

/** Clamp a 1-based page into [1, pageCount]; 1 when nothing is loaded. */
export function clampPageNumber(page: number, pageCount: number): number {
	if (!Number.isFinite(pageCount) || pageCount < 1) return DEFAULT_THUMBNAIL_PAGE;
	if (!Number.isFinite(page)) return DEFAULT_THUMBNAIL_PAGE;
	return Math.min(Math.max(Math.floor(page), 1), Math.floor(pageCount));
}

/**
 * Scale factor that maps a page width (points at scale 1) onto a target CSS
 * width. Falls back to 1 for invalid inputs so callers always get a usable scale.
 */
export function thumbnailScale(pageWidth: number, targetWidth: number, dpr = 1): number {
	if (
		!Number.isFinite(pageWidth) ||
		!Number.isFinite(targetWidth) ||
		!Number.isFinite(dpr) ||
		pageWidth <= 0 ||
		targetWidth <= 0 ||
		dpr <= 0
	) {
		return 1;
	}
	return (targetWidth * dpr) / pageWidth;
}

/**
 * Render one PDF page into a canvas at the requested CSS width. The engine
 * loads the document, then the page renders through renderLoadedPdfThumbnail.
 * Only the single requested page is ever rendered.
 */
export async function renderPdfThumbnail(
	engine: PdfEngine,
	source: PdfSource,
	canvas: HTMLCanvasElement,
	options: PdfThumbnailRenderOptions = {}
): Promise<PdfThumbnailRenderResult> {
	const pageCount = await engine.load(source);
	return renderLoadedPdfThumbnail(engine, pageCount, canvas, options);
}

/**
 * Render one page of an already-loaded document at the requested CSS width,
 * so many pages can share a single load. The page is measured with a scale-1
 * render, and a second render targets the exact width (skipped when the scale
 * is already 1).
 */
export async function renderLoadedPdfThumbnail(
	engine: PdfEngine,
	pageCount: number,
	canvas: HTMLCanvasElement,
	options: PdfThumbnailRenderOptions = {}
): Promise<PdfThumbnailRenderResult> {
	const pageNumber = clampPageNumber(options.pageNumber ?? DEFAULT_THUMBNAIL_PAGE, pageCount);
	const width = options.width ?? DEFAULT_THUMBNAIL_WIDTH;
	const dpr = options.dpr ?? 1;

	const measured = await engine.renderPage(pageNumber, canvas, { scale: 1 });
	const scale = thumbnailScale(measured.width, width, dpr);
	if (scale !== 1) {
		await engine.renderPage(pageNumber, canvas, { scale });
	}

	const aspect = measured.width > 0 ? measured.height / measured.width : 1;
	return { pageCount, pageNumber, width, height: width * aspect };
}
