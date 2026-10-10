// MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
// Pure helper tests (no DOM): run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import {
	clampZoom,
	computeActivePage,
	DEFAULT_ZOOM,
	ensurePdfExtension,
	formatZoomPercent,
	getPdfDownloadFileName,
	getRotatedPdfDownloadFileName,
	normalizeRotation,
	resolveInitialZoom,
	rotateClockwise,
	rotateCounterClockwise,
	ZOOM_OPTIONS,
	zoomStepIn,
	zoomStepOut
} from './zoom.js';

describe('resolveInitialZoom', () => {
	it('uses the numeric default zoom', () => {
		expect(resolveInitialZoom(1.5)).toBe(1.5);
	});

	it('falls back to DEFAULT_ZOOM for fit modes and undefined', () => {
		expect(resolveInitialZoom(undefined)).toBe(DEFAULT_ZOOM);
		expect(resolveInitialZoom('fit-page')).toBe(DEFAULT_ZOOM);
		expect(resolveInitialZoom('fit-width')).toBe(DEFAULT_ZOOM);
		expect(resolveInitialZoom('automatic')).toBe(DEFAULT_ZOOM);
	});

	it('clamps out-of-range numeric defaults', () => {
		expect(resolveInitialZoom(99)).toBe(ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]);
		expect(resolveInitialZoom(0.001)).toBe(ZOOM_OPTIONS[0]);
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

describe('computeActivePage', () => {
	it('returns the first page at the top', () => {
		expect(computeActivePage(0, 800, 5)).toBe(1);
	});

	it('advances the active page with scroll position', () => {
		expect(computeActivePage(799, 800, 5)).toBe(1);
		expect(computeActivePage(800, 800, 5)).toBe(2);
		expect(computeActivePage(2400, 800, 5)).toBe(4);
	});

	it('clamps to the loaded page range', () => {
		expect(computeActivePage(99999, 800, 5)).toBe(5);
		expect(computeActivePage(-50, 800, 5)).toBe(1);
	});

	it('returns 0 when no document is loaded', () => {
		expect(computeActivePage(0, 800, 0)).toBe(0);
	});
});
