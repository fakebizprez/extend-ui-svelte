// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Pure helper tests (no DOM): run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import {
	anchorOffset,
	clampZoom,
	computeFitZoom,
	computePageLayout,
	ensurePdfExtension,
	formatZoomPercent,
	getPdfDownloadFileName,
	getRotatedPdfDownloadFileName,
	isZoomMode,
	normalizeRotation,
	pageAnchorAt,
	pageAtOffset,
	pageWindow,
	resolveZoom,
	rotatedPageSize,
	rotateClockwise,
	rotateCounterClockwise,
	zoomSelectOptions,
	zoomSelectValue,
	ZOOM_MODES,
	ZOOM_OPTIONS,
	zoomStepByRange,
	zoomStepIn,
	zoomStepOut
} from './zoom.js';

const LETTER = { width: 612, height: 792 };
const LANDSCAPE = { width: 792, height: 612 };
// Viewport 800x600 with the 24px gap upstream uses: 752x552 available.
const VIEWPORT = { width: 800, height: 600, gap: 24 };

describe('zoom modes', () => {
	it('lists the upstream zoom modes in toolbar order', () => {
		expect(ZOOM_MODES).toEqual([
			{ value: 'fit-page', label: 'Fit page' },
			{ value: 'fit-width', label: 'Fit width' },
			{ value: 'automatic', label: 'Automatic' }
		]);
		expect(isZoomMode('fit-width')).toBe(true);
		expect(isZoomMode('1')).toBe(false);
		expect(isZoomMode(1)).toBe(false);
	});

	it('fits the widest page to the available width', () => {
		expect(computeFitZoom('fit-width', VIEWPORT, [LETTER, LANDSCAPE])).toBeCloseTo(752 / 792);
	});

	it('fits the whole page inside the available width and height', () => {
		expect(computeFitZoom('fit-page', VIEWPORT, [LETTER])).toBeCloseTo(552 / 792);
	});

	it('uses fit width but never zooms past 100% in automatic mode', () => {
		expect(computeFitZoom('automatic', VIEWPORT, [LETTER])).toBe(1);
		expect(computeFitZoom('automatic', { width: 500, height: 600, gap: 24 }, [LETTER])).toBeCloseTo(
			452 / 612
		);
	});

	it('returns null before the viewport is measured or pages are known', () => {
		expect(computeFitZoom('fit-width', { width: 0, height: 0, gap: 24 }, [LETTER])).toBeNull();
		expect(computeFitZoom('fit-width', VIEWPORT, [])).toBeNull();
		expect(computeFitZoom('fit-width', { width: 40, height: 600, gap: 24 }, [LETTER])).toBeNull();
	});

	it('resolves numeric and mode levels, clamped and floored to 3 decimals like upstream', () => {
		expect(resolveZoom(1.5, VIEWPORT, [LETTER])).toBe(1.5);
		expect(resolveZoom(99, VIEWPORT, [LETTER])).toBe(2);
		expect(resolveZoom(0.001, VIEWPORT, [LETTER])).toBe(0.1);
		expect(resolveZoom('fit-width', VIEWPORT, [LETTER])).toBe(1.228);
		expect(resolveZoom('fit-width', VIEWPORT, [LETTER], 0.1, 8)).toBe(1.228);
		expect(resolveZoom('fit-width', { width: 4000, height: 600, gap: 24 }, [LETTER], 0.1, 8)).toBe(
			6.457
		);
	});

	it('falls back to 100% for a mode before the viewport is measured', () => {
		expect(resolveZoom('fit-page', { width: 0, height: 0, gap: 24 }, [LETTER])).toBe(1);
	});

	it('builds the zoom dropdown value and options like upstream', () => {
		expect(zoomSelectValue('fit-width', 1.228)).toBe('fit-width');
		expect(zoomSelectValue(1.25, 1.25)).toBe('1.25');
		expect(zoomSelectOptions(1)).toEqual(ZOOM_OPTIONS);
		expect(zoomSelectOptions(1.228)).toEqual([0.1, 0.25, 0.5, 0.75, 1, 1.23, 1.25, 1.5, 2]);
	});
});

describe('zoom stepping', () => {
	it('steps out and in through the fixed zoom options', () => {
		expect(zoomStepOut(1)).toBe(0.75);
		expect(zoomStepIn(1)).toBe(1.25);
		expect(zoomStepOut(0.1)).toBe(0.1);
		expect(zoomStepIn(2)).toBe(2);
	});

	it('snaps mid-step values to the next option', () => {
		expect(zoomStepOut(1.1)).toBe(1);
		expect(zoomStepIn(1.1)).toBe(1.25);
	});

	it('clamps arbitrary values into range', () => {
		expect(clampZoom(99)).toBe(2);
		expect(clampZoom(-1)).toBe(0.1);
		expect(clampZoom(1.25)).toBe(1.25);
	});

	it('formats zoom as a percent label', () => {
		expect(formatZoomPercent(1)).toBe('100%');
		expect(formatZoomPercent(1.25)).toBe('125%');
		expect(formatZoomPercent(0.1)).toBe('10%');
	});
});

describe('zoomStepByRange', () => {
	// EmbedPDF's default zoom ranges, used by the upstream editor's zoom buttons.
	it('steps by the range the current zoom falls in', () => {
		expect(zoomStepByRange(1, 1, 0.1, 8)).toBe(1.2);
		expect(zoomStepByRange(1, -1, 0.1, 8)).toBe(0.8);
		expect(zoomStepByRange(0.3, 1, 0.1, 8)).toBe(0.35);
		expect(zoomStepByRange(0.6, -1, 0.1, 8)).toBe(0.5);
		expect(zoomStepByRange(2, 1, 0.1, 8)).toBe(2.4);
		expect(zoomStepByRange(5, 1, 0.1, 8)).toBe(5.8);
	});

	it('uses a 0.1 step below the smallest range and clamps to the limits', () => {
		expect(zoomStepByRange(0.15, -1, 0.1, 8)).toBe(0.1);
		expect(zoomStepByRange(0.1, -1, 0.1, 8)).toBe(0.1);
		expect(zoomStepByRange(7.9, 1, 0.1, 8)).toBe(8);
	});
});

describe('rotation', () => {
	it('normalizes arbitrary degrees to quarter turns', () => {
		expect(normalizeRotation(0)).toBe(0);
		expect(normalizeRotation(90)).toBe(90);
		expect(normalizeRotation(360)).toBe(0);
		expect(normalizeRotation(-90)).toBe(270);
		expect(normalizeRotation(91)).toBe(90);
		expect(normalizeRotation(460)).toBe(90);
	});

	it('rotates clockwise and counter-clockwise in 90-degree steps', () => {
		expect(rotateClockwise(0)).toBe(90);
		expect(rotateClockwise(270)).toBe(0);
		expect(rotateCounterClockwise(0)).toBe(270);
		expect(rotateCounterClockwise(90)).toBe(0);
	});
});

describe('download file names', () => {
	it('ensures a .pdf extension', () => {
		expect(ensurePdfExtension('report')).toBe('report.pdf');
		expect(ensurePdfExtension('report.PDF')).toBe('report.PDF');
	});

	it('prefers the explicit fileName', () => {
		expect(getPdfDownloadFileName('invoice', 'https://example.com/other.pdf')).toBe('invoice.pdf');
		expect(getPdfDownloadFileName('  invoice  ', 'https://example.com/other.pdf')).toBe(
			'invoice.pdf'
		);
	});

	it('derives the name from the src URL when no fileName is given', () => {
		expect(getPdfDownloadFileName(undefined, 'https://example.com/files/bank.pdf?v=2')).toBe(
			'bank.pdf'
		);
		expect(getPdfDownloadFileName(undefined, 'https://example.com/files/report')).toBe(
			'report.pdf'
		);
	});

	it('falls back to document.pdf for an empty src name', () => {
		expect(getPdfDownloadFileName(undefined, 'https://example.com/files/')).toBe('document.pdf');
	});

	it('marks rotated downloads with a -rotated suffix', () => {
		expect(getRotatedPdfDownloadFileName('bank.pdf')).toBe('bank-rotated.pdf');
	});
});

describe('page layout', () => {
	it('swaps width and height for quarter turns', () => {
		expect(rotatedPageSize(LETTER, 0)).toEqual(LETTER);
		expect(rotatedPageSize(LETTER, 90)).toEqual(LANDSCAPE);
		expect(rotatedPageSize(LETTER, 180)).toEqual(LETTER);
		expect(rotatedPageSize(LETTER, 270)).toEqual(LANDSCAPE);
	});

	it('stacks pages of different heights with a gap around and between them', () => {
		const layout = computePageLayout([{ width: 100, height: 200 }, { width: 300, height: 50 }], 10);
		expect(layout.tops).toEqual([10, 220]);
		expect(layout.heights).toEqual([200, 50]);
		expect(layout.totalHeight).toBe(280);
		expect(layout.totalWidth).toBe(320);
	});

	it('is empty without pages', () => {
		expect(computePageLayout([], 24)).toEqual({ tops: [], heights: [], totalHeight: 0, totalWidth: 0 });
	});

	it('finds the page at a scroll offset, 1-based', () => {
		const layout = computePageLayout(
			[{ width: 1, height: 100 }, { width: 1, height: 300 }, { width: 1, height: 100 }],
			0
		);
		expect(pageAtOffset(layout, 0)).toBe(1);
		expect(pageAtOffset(layout, 99)).toBe(1);
		expect(pageAtOffset(layout, 100)).toBe(2);
		expect(pageAtOffset(layout, 399)).toBe(2);
		expect(pageAtOffset(layout, 400)).toBe(3);
		expect(pageAtOffset(layout, 99999)).toBe(3);
		expect(pageAtOffset(layout, -5)).toBe(1);
		expect(pageAtOffset(computePageLayout([], 0), 0)).toBe(0);
	});

	it('anchors a scroll offset to a page and a fraction of its height', () => {
		const before = computePageLayout([{ width: 1, height: 100 }, { width: 1, height: 200 }], 0);
		const after = computePageLayout([{ width: 1, height: 200 }, { width: 1, height: 400 }], 0);
		const anchor = pageAnchorAt(before, 150);
		expect(anchor).toEqual({ index: 1, fraction: 0.25 });
		// The same document point after zooming 2x: top of page 2 (200) + 25% of 400.
		expect(anchorOffset(after, anchor!)).toBe(300);
		expect(pageAnchorAt(computePageLayout([], 0), 0)).toBeNull();
	});

	it('windows only the pages in view plus overscan', () => {
		const sizes = Array.from({ length: 100 }, () => ({ width: 1, height: 100 }));
		const layout = computePageLayout(sizes, 0);
		expect(pageWindow(layout, 0, 250, 1)).toEqual({ start: 0, end: 4 });
		expect(pageWindow(layout, 5000, 250, 2)).toEqual({ start: 48, end: 55 });
		expect(pageWindow(layout, 999999, 250, 1)).toEqual({ start: 96, end: 100 });
		expect(pageWindow(computePageLayout([], 0), 0, 250, 1)).toEqual({ start: 0, end: 0 });
	});
});
