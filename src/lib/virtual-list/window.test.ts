// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import {
	computeVariableWindow,
	computeWindow,
	DEFAULT_OVERSCAN,
	offsetTopForIndex,
	prefixOffsets,
	totalHeight
} from './window';

describe('computeWindow', () => {
	it('windows a large list instead of rendering everything', () => {
		const range = computeWindow({
			itemCount: 10000,
			itemHeight: 30,
			viewportHeight: 300,
			scrollTop: 0,
			overscan: 2
		});

		// 10 visible rows plus 2 overscan rows below; nothing above at the top.
		expect(range).toEqual({ start: 0, end: 12 });
		expect(range.end - range.start).toBeLessThan(10000);
	});

	it('slides the window as the user scrolls', () => {
		const range = computeWindow({
			itemCount: 10000,
			itemHeight: 30,
			viewportHeight: 300,
			scrollTop: 1500,
			overscan: 2
		});

		// Rows 50..60 visible, overscan on both sides.
		expect(range).toEqual({ start: 48, end: 62 });
	});

	it('returns an empty range for an empty list', () => {
		expect(
			computeWindow({ itemCount: 0, itemHeight: 30, viewportHeight: 300, scrollTop: 0 })
		).toEqual({ start: 0, end: 0 });
	});

	it('renders the single row of a one-item list', () => {
		expect(
			computeWindow({ itemCount: 1, itemHeight: 30, viewportHeight: 300, scrollTop: 0 })
		).toEqual({ start: 0, end: 1 });
	});

	it('includes the last item when scrolled to the end', () => {
		const itemCount = 100;
		const itemHeight = 30;
		const viewportHeight = 300;
		const maxScrollTop = itemCount * itemHeight - viewportHeight;

		const range = computeWindow({
			itemCount,
			itemHeight,
			viewportHeight,
			scrollTop: maxScrollTop,
			overscan: 2
		});

		expect(range.end).toBe(itemCount);
		expect(range).toEqual({ start: 88, end: 100 });
	});

	it('clamps scroll positions past the end', () => {
		const range = computeWindow({
			itemCount: 100,
			itemHeight: 30,
			viewportHeight: 300,
			scrollTop: 999999,
			overscan: 0
		});

		expect(range).toEqual({ start: 90, end: 100 });
	});

	it('clamps negative scroll positions to the top', () => {
		const range = computeWindow({
			itemCount: 100,
			itemHeight: 30,
			viewportHeight: 300,
			scrollTop: -50,
			overscan: 0
		});

		expect(range).toEqual({ start: 0, end: 10 });
	});

	it('renders everything when the list fits in the viewport', () => {
		expect(
			computeWindow({ itemCount: 5, itemHeight: 30, viewportHeight: 300, scrollTop: 0 })
		).toEqual({ start: 0, end: 5 });
	});

	it('applies the default overscan when none is given', () => {
		expect(DEFAULT_OVERSCAN).toBeGreaterThan(0);

		const explicit = computeWindow({
			itemCount: 10000,
			itemHeight: 30,
			viewportHeight: 300,
			scrollTop: 1500,
			overscan: DEFAULT_OVERSCAN
		});
		const implicit = computeWindow({
			itemCount: 10000,
			itemHeight: 30,
			viewportHeight: 300,
			scrollTop: 1500
		});

		expect(implicit).toEqual(explicit);
	});
});

describe('totalHeight', () => {
	it('multiplies item count by item height', () => {
		expect(totalHeight(100, 30)).toBe(3000);
		expect(totalHeight(0, 30)).toBe(0);
	});
});

describe('offsetTopForIndex', () => {
	it('places each row at its index times the item height', () => {
		expect(offsetTopForIndex(0, 30)).toBe(0);
		expect(offsetTopForIndex(7, 30)).toBe(210);
	});
});

describe('variable-height windowing', () => {
	it('builds prefix offsets whose last entry is the total height', () => {
		expect(prefixOffsets([10, 20, 30])).toEqual([0, 10, 30, 60]);
		expect(prefixOffsets([])).toEqual([0]);
	});

	it('windows rows of different heights around the viewport', () => {
		// Rows: 0-100, 100-150, 150-350, 350-360, 360-460, 460-560.
		const offsets = prefixOffsets([100, 50, 200, 10, 100, 100]);

		expect(
			computeVariableWindow({ offsets, viewportHeight: 120, scrollTop: 0, overscan: 0 })
		).toEqual({ start: 0, end: 2 });
		expect(
			computeVariableWindow({ offsets, viewportHeight: 100, scrollTop: 160, overscan: 0 })
		).toEqual({ start: 2, end: 3 });
		expect(
			computeVariableWindow({ offsets, viewportHeight: 100, scrollTop: 160, overscan: 1 })
		).toEqual({ start: 1, end: 4 });
	});

	it('clamps the scroll offset and handles empty lists', () => {
		const offsets = prefixOffsets([100, 100, 100]);
		expect(
			computeVariableWindow({ offsets, viewportHeight: 150, scrollTop: 9999, overscan: 0 })
		).toEqual({ start: 1, end: 3 });
		expect(
			computeVariableWindow({ offsets: [0], viewportHeight: 150, scrollTop: 0 })
		).toEqual({ start: 0, end: 0 });
	});
});
