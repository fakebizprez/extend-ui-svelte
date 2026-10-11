// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Unit tests for the framework-free e-signature PDF helpers (node project).
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
	clampPage,
	clampScale,
	dataUrlToBytes,
	DEFAULT_POSITION_X,
	DEFAULT_POSITION_Y,
	DEFAULT_SCALE,
	DEFAULT_SIGNATURE_HEIGHT,
	DEFAULT_SIGNATURE_WIDTH,
	defaultPlacementForPage,
	embedSignaturePng,
	getSignedDownloadFileName,
	MAX_SCALE,
	MIN_SCALE,
	resolvePlacement
} from './sign-pdf.js';

const ONE_PX_PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function blankPdfBytes(pages = 1): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	for (let i = 0; i < pages; i += 1) {
		doc.addPage([612, 792]);
	}
	return await doc.save();
}

describe('defaultPlacementForPage', () => {
	it('keeps upstream\'s field on a Letter page', () => {
		expect(defaultPlacementForPage(612, 792)).toEqual({ x: 300, y: 230, width: 250, height: 58 });
	});

	it('scales upstream\'s field by pageWidth/612 and pageHeight/792 on A4', () => {
		const placement = defaultPlacementForPage(595.28, 841.89);
		expect(placement.x).toBeCloseTo(291.8, 1);
		expect(placement.y).toBeCloseTo(244.5, 1);
		expect(placement.width).toBeCloseTo(243.2, 1);
		expect(placement.height).toBeCloseTo(61.65, 1);
	});
});

describe('signature placement helpers', () => {
	it('exposes the documented defaults', () => {
		// Upstream's INITIAL_FIELD bbox { x: 300, y: 504, width: 250, height: 58 } is
		// measured from the top-left of a 612x792 page; y here is from the bottom.
		expect(DEFAULT_SIGNATURE_WIDTH).toBe(250);
		expect(DEFAULT_SIGNATURE_HEIGHT).toBe(58);
		expect(DEFAULT_POSITION_X).toBe(300);
		expect(DEFAULT_POSITION_Y).toBe(792 - (504 + 58));
		expect(DEFAULT_SCALE).toBe(1);
		expect(MIN_SCALE).toBe(0.25);
		expect(MAX_SCALE).toBe(3);
	});

	it('clamps the scale into the slider range', () => {
		expect(clampScale(1)).toBe(1);
		expect(clampScale(0)).toBe(MIN_SCALE);
		expect(clampScale(-2)).toBe(MIN_SCALE);
		expect(clampScale(99)).toBe(MAX_SCALE);
		expect(clampScale(Number.NaN)).toBe(DEFAULT_SCALE);
	});

	it('clamps the page into the loaded document', () => {
		expect(clampPage(2, 3)).toBe(2);
		expect(clampPage(0, 3)).toBe(1);
		expect(clampPage(9, 3)).toBe(3);
		expect(clampPage(1, 0)).toBe(0);
	});

	it('resolves a placement by scaling the signature box', () => {
		expect(
			resolvePlacement({
				page: 2,
				x: 72,
				y: 100,
				width: 150,
				height: 50,
				scale: 2,
				pageCount: 3
			})
		).toEqual({ page: 2, x: 72, y: 100, width: 300, height: 100 });
	});

	it('resolves a placement with clamped scale and page', () => {
		expect(
			resolvePlacement({
				page: 9,
				x: -10,
				y: -5,
				width: 150,
				height: 50,
				scale: 99,
				pageCount: 3
			})
		).toEqual({ page: 3, x: 0, y: 0, width: 450, height: 150 });
	});
});

describe('dataUrlToBytes', () => {
	it('decodes a PNG data URL into bytes', () => {
		const bytes = dataUrlToBytes(ONE_PX_PNG_DATA_URL);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBeGreaterThan(0);
		// PNG magic bytes.
		expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
	});

	it('rejects malformed data URLs', () => {
		expect(() => dataUrlToBytes('not-a-data-url')).toThrow(TypeError);
		expect(() => dataUrlToBytes('data:image/png;base64,%%%')).toThrow(TypeError);
	});
});

describe('embedSignaturePng', () => {
	it('embeds the signature and keeps the page count', async () => {
		const pdfBytes = await blankPdfBytes(3);
		const pngBytes = dataUrlToBytes(ONE_PX_PNG_DATA_URL);
		const placement = resolvePlacement({
			page: 2,
			x: 72,
			y: 72,
			width: 150,
			height: 50,
			scale: 1,
			pageCount: 3
		});

		const signed = await embedSignaturePng(pdfBytes, pngBytes, placement);

		expect(signed).toBeInstanceOf(Uint8Array);
		expect(signed.length).toBeGreaterThan(pdfBytes.length);
		const reloaded = await PDFDocument.load(signed);
		expect(reloaded.getPageCount()).toBe(3);
	});

	it('rejects out-of-range pages', async () => {
		const pdfBytes = await blankPdfBytes(1);
		const pngBytes = dataUrlToBytes(ONE_PX_PNG_DATA_URL);

		await expect(
			embedSignaturePng(pdfBytes, pngBytes, { page: 2, x: 72, y: 72, width: 150, height: 50 })
		).rejects.toThrow(RangeError);
		await expect(
			embedSignaturePng(pdfBytes, pngBytes, { page: 0, x: 72, y: 72, width: 150, height: 50 })
		).rejects.toThrow(RangeError);
	});
});

describe('getSignedDownloadFileName', () => {
	it('marks the explicit file name as signed', () => {
		expect(getSignedDownloadFileName('contract', 'https://example.com/a.pdf')).toBe(
			'contract-signed.pdf'
		);
		expect(getSignedDownloadFileName('contract.pdf', 'https://example.com/a.pdf')).toBe(
			'contract-signed.pdf'
		);
	});

	it('falls back to the source name and then a default', () => {
		expect(getSignedDownloadFileName(undefined, 'https://example.com/files/bank.pdf')).toBe(
			'bank-signed.pdf'
		);
		expect(getSignedDownloadFileName(undefined, '')).toBe('document-signed.pdf');
		expect(getSignedDownloadFileName('   ', '')).toBe('document-signed.pdf');
	});
});
