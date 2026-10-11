// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Unit tests for the file-thumbnail PDF helper (pure logic + engine orchestration).
import { describe, expect, it, vi } from 'vitest';
import type { PdfEngine, PdfPageSize, PdfSource } from '../../engines/pdf/index.js';
import {
	clampPageNumber,
	DEFAULT_THUMBNAIL_PAGE,
	DEFAULT_THUMBNAIL_WIDTH,
	renderPdfThumbnail,
	thumbnailScale
} from './pdf-thumbnail.js';

function fakeEngine(pageSizes: PdfPageSize[], rendered: { scale: number; page: number }[]) {
	const engine: PdfEngine = {
		get pageCount() {
			return pageSizes.length;
		},
		get currentPage() {
			return 1;
		},
		load: vi.fn(async (_source: PdfSource) => pageSizes.length),
		getPageSizes: vi.fn(async () => pageSizes),
		renderPage: vi.fn(async (pageNumber: number, _canvas: HTMLCanvasElement, options) => {
			const size = pageSizes[pageNumber - 1] ?? { width: 0, height: 0 };
			const scale = options?.scale ?? 1;
			rendered.push({ scale, page: pageNumber });
			return { width: size.width * scale, height: size.height * scale };
		}),
		setCurrentPage: vi.fn(),
		onPageChange: vi.fn(() => () => {}),
		destroy: vi.fn(async () => {})
	};
	return engine;
}

describe('clampPageNumber', () => {
	it('returns the default page when no document is loaded', () => {
		expect(clampPageNumber(5, 0)).toBe(DEFAULT_THUMBNAIL_PAGE);
		expect(clampPageNumber(-2, 0)).toBe(DEFAULT_THUMBNAIL_PAGE);
	});

	it('clamps below 1 up to the first page', () => {
		expect(clampPageNumber(0, 3)).toBe(1);
		expect(clampPageNumber(-10, 3)).toBe(1);
	});

	it('clamps above the page count down to the last page', () => {
		expect(clampPageNumber(4, 3)).toBe(3);
		expect(clampPageNumber(99, 3)).toBe(3);
	});

	it('floors fractional pages and passes through valid pages', () => {
		expect(clampPageNumber(2.9, 3)).toBe(2);
		expect(clampPageNumber(2, 3)).toBe(2);
	});
});

describe('thumbnailScale', () => {
	it('scales a page width to the target CSS width', () => {
		expect(thumbnailScale(612, 240)).toBeCloseTo(240 / 612, 10);
	});

	it('multiplies by the device pixel ratio for crisp output', () => {
		expect(thumbnailScale(612, 240, 2)).toBeCloseTo(480 / 612, 10);
	});

	it('falls back to scale 1 for invalid inputs', () => {
		expect(thumbnailScale(0, 240)).toBe(1);
		expect(thumbnailScale(-612, 240)).toBe(1);
		expect(thumbnailScale(612, 0)).toBe(1);
		expect(thumbnailScale(612, -5)).toBe(1);
		expect(thumbnailScale(Number.NaN, 240)).toBe(1);
		expect(thumbnailScale(612, 240, 0)).toBe(1);
	});
});

describe('renderPdfThumbnail', () => {
	const canvas = {} as HTMLCanvasElement;

	it('loads the source, measures at scale 1, then renders at the target width', async () => {
		const rendered: { scale: number; page: number }[] = [];
		const engine = fakeEngine([{ width: 612, height: 792 }], rendered);

		const result = await renderPdfThumbnail(engine, '/fixtures/sample.pdf', canvas, {
			pageNumber: 1,
			width: 240,
			dpr: 1
		});

		expect(engine.load).toHaveBeenCalledWith('/fixtures/sample.pdf');
		expect(rendered).toHaveLength(2);
		expect(rendered[0]).toEqual({ scale: 1, page: 1 });
		expect(rendered[1]?.page).toBe(1);
		expect(rendered[1]?.scale).toBeCloseTo(240 / 612, 10);
		expect(result).toEqual({
			pageCount: 1,
			pageNumber: 1,
			width: 240,
			height: 240 * (792 / 612)
		});
	});

	it('renders only once when the target scale is already 1', async () => {
		const rendered: { scale: number; page: number }[] = [];
		const engine = fakeEngine([{ width: 240, height: 240 }], rendered);

		await renderPdfThumbnail(engine, '/fixtures/sample.pdf', canvas, {
			pageNumber: 1,
			width: 240,
			dpr: 1
		});

		expect(rendered).toEqual([{ scale: 1, page: 1 }]);
	});

	it('clamps the requested page into the loaded document', async () => {
		const rendered: { scale: number; page: number }[] = [];
		const engine = fakeEngine(
			[
				{ width: 100, height: 100 },
				{ width: 100, height: 100 }
			],
			rendered
		);

		const result = await renderPdfThumbnail(engine, '/fixtures/sample.pdf', canvas, {
			pageNumber: 99
		});

		expect(result.pageNumber).toBe(2);
		expect(result.pageCount).toBe(2);
		expect(rendered.every((call) => call.page === 2)).toBe(true);
	});

	it('uses the default width and first page when options are omitted', async () => {
		const rendered: { scale: number; page: number }[] = [];
		const engine = fakeEngine([{ width: 600, height: 800 }], rendered);

		const result = await renderPdfThumbnail(engine, new Uint8Array([1, 2, 3]), canvas);

		expect(engine.load).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
		expect(result.pageNumber).toBe(DEFAULT_THUMBNAIL_PAGE);
		expect(result.width).toBe(DEFAULT_THUMBNAIL_WIDTH);
		expect(rendered[1]?.scale).toBeCloseTo(DEFAULT_THUMBNAIL_WIDTH / 600, 10);
	});

	it('propagates load failures to the caller', async () => {
		const rendered: { scale: number; page: number }[] = [];
		const engine = fakeEngine([{ width: 100, height: 100 }], rendered);
		engine.load = vi.fn(async () => {
			throw new Error('network down');
		});

		await expect(renderPdfThumbnail(engine, '/missing.pdf', canvas)).rejects.toThrow(
			'network down'
		);
		expect(rendered).toHaveLength(0);
	});
});
