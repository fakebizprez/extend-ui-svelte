// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Framework-free e-signature placement and PDF stamping helpers.
//
// Coordinates follow pdf-lib: origin at the bottom-left of the page,
// measured in PDF points (1/72 inch). pdf-lib is isomorphic, so this module
// is safe to import during SSR; the canvas-based signature_pad wrapper stays
// in the component and loads on the client only.
import { PDFDocument } from 'pdf-lib';

/** Signature box width in PDF points before scaling. */
export const DEFAULT_SIGNATURE_WIDTH = 150;

/** Signature box height in PDF points before scaling. */
export const DEFAULT_SIGNATURE_HEIGHT = 50;

/** Placement offset from the left page edge in PDF points. */
export const DEFAULT_POSITION_X = 72;

/** Placement offset from the bottom page edge in PDF points. */
export const DEFAULT_POSITION_Y = 72;

/** Default placement scale multiplier. */
export const DEFAULT_SCALE = 1;

/** Minimum placement scale offered by the scale control. */
export const MIN_SCALE = 0.25;

/** Maximum placement scale offered by the scale control. */
export const MAX_SCALE = 3;

/** Resolved signature placement on one PDF page. */
export interface SignaturePlacement {
	/** 1-based page number. */
	page: number;
	/** Offset from the left page edge in PDF points. */
	x: number;
	/** Offset from the bottom page edge in PDF points. */
	y: number;
	/** Box width in PDF points after scaling. */
	width: number;
	/** Box height in PDF points after scaling. */
	height: number;
}

/** Unresolved placement input: raw control values plus the page count. */
export interface SignaturePlacementInput {
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
	scale: number;
	pageCount: number;
}

/** Clamp a scale into the slider range; NaN falls back to the default. */
export function clampScale(value: number): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_SCALE;
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/** Clamp a 1-based page into the loaded document; 0 when nothing is loaded. */
export function clampPage(page: number, pageCount: number): number {
	if (!(pageCount > 0)) return 0;
	if (typeof page !== 'number' || Number.isNaN(page)) return 1;
	return Math.min(pageCount, Math.max(1, Math.floor(page)));
}

/**
 * Resolve raw placement controls into PDF points: the page is clamped into
 * the document, negative offsets are clamped to the page corner, and the
 * signature box is multiplied by the clamped scale.
 */
export function resolvePlacement(input: SignaturePlacementInput): SignaturePlacement {
	const scale = clampScale(input.scale);
	return {
		page: clampPage(input.page, input.pageCount),
		x: Math.max(0, input.x),
		y: Math.max(0, input.y),
		width: Math.max(0, input.width) * scale,
		height: Math.max(0, input.height) * scale
	};
}

/** Decode a `data:image/...;base64,...` URL into raw bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
	const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/.exec(
		(dataUrl ?? '').trim()
	);
	if (!match?.[1]) {
		throw new TypeError('dataUrlToBytes: expected a base64 image data URL.');
	}
	let binary: string;
	try {
		binary = atob(match[1]);
	} catch {
		throw new TypeError('dataUrlToBytes: expected a base64 image data URL.');
	}
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Stamp PNG signature bytes onto one page of the PDF and return the saved
 * document bytes. The input is never mutated; placing again onto the
 * original bytes replaces the previous stamp instead of stacking it.
 */
export async function embedSignaturePng(
	pdfBytes: Uint8Array,
	pngBytes: Uint8Array,
	placement: SignaturePlacement
): Promise<Uint8Array> {
	const doc = await PDFDocument.load(pdfBytes);
	const pageCount = doc.getPageCount();
	if (!Number.isInteger(placement.page) || placement.page < 1 || placement.page > pageCount) {
		throw new RangeError(
			`embedSignaturePng: page ${placement.page} out of range (1..${pageCount}).`
		);
	}
	const png = await doc.embedPng(pngBytes);
	doc.getPage(placement.page - 1).drawImage(png, {
		x: placement.x,
		y: placement.y,
		width: placement.width,
		height: placement.height
	});
	return await doc.save();
}

/** Append ".pdf" unless the name already ends with it (case-insensitive). */
export function ensurePdfExtension(fileName: string): string {
	return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
}

/**
 * Download file name for the signed document: the explicit fileName wins,
 * otherwise the last src path segment (query and hash stripped) is used,
 * falling back to "document". The base is marked "-signed".
 */
export function getSignedDownloadFileName(fileName: string | undefined, src: string): string {
	let base = 'document';
	if (fileName?.trim()) {
		base = fileName.trim();
	} else {
		const pathname = (src.split(/[?#]/)[0] ?? '').trim();
		const rawName = pathname.split('/').pop();
		if (rawName) base = rawName;
	}
	try {
		base = decodeURIComponent(base);
	} catch {
		// Keep the raw base when it is not valid percent-encoding.
	}
	return ensurePdfExtension(`${base.replace(/\.pdf$/i, '')}-signed`);
}
