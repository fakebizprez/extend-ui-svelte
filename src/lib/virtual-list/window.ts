// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
//
// Framework-free windowing math for the shared virtual list. Pages, sheet
// rows, and slide lists all use this so large content never renders at once.

/** Extra rows rendered above and below the viewport when none is given. */
export const DEFAULT_OVERSCAN = 3;

export interface VirtualWindowOptions {
	/** Total number of items in the list. */
	itemCount: number;
	/** Fixed height of one item in pixels. */
	itemHeight: number;
	/** Visible height of the scroll viewport in pixels. */
	viewportHeight: number;
	/** Current scroll offset in pixels. */
	scrollTop: number;
	/** Extra items rendered above and below the visible range. */
	overscan?: number;
}

/** Half-open `[start, end)` index range to render. */
export interface VirtualWindow {
	start: number;
	end: number;
}

/** Compute the half-open index range that should be rendered. */
export function computeWindow(options: VirtualWindowOptions): VirtualWindow {
	const { itemCount, itemHeight, viewportHeight, overscan = DEFAULT_OVERSCAN } = options;

	if (itemCount <= 0) return { start: 0, end: 0 };

	const maxScrollTop = Math.max(0, totalHeight(itemCount, itemHeight) - viewportHeight);
	const scrollTop = Math.min(Math.max(0, options.scrollTop), maxScrollTop);

	const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
	const end = Math.min(
		itemCount,
		Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
	);

	return { start, end };
}

/** Total scrollable height of the list in pixels. */
export function totalHeight(itemCount: number, itemHeight: number): number {
	return itemCount * itemHeight;
}

/** Pixel offset of the top edge of the item at `index`. */
export function offsetTopForIndex(index: number, itemHeight: number): number {
	return index * itemHeight;
}

/** Prefix offsets for variable row sizes: `offsets[i]` is the top of row `i`, `offsets[n]` the total height. */
export function prefixOffsets(sizes: number[]): number[] {
	const offsets = [0];
	for (const size of sizes) offsets.push((offsets[offsets.length - 1] ?? 0) + size);
	return offsets;
}

export interface VariableWindowOptions {
	/** Prefix offsets from `prefixOffsets`. */
	offsets: number[];
	/** Visible height of the scroll viewport in pixels. */
	viewportHeight: number;
	/** Current scroll offset in pixels. */
	scrollTop: number;
	/** Extra items rendered above and below the visible range. */
	overscan?: number;
}

/** Largest index `i` in `[0, offsets.length - 1)` with `offsets[i] <= value` (binary search). */
function rowAt(offsets: number[], value: number): number {
	let low = 0;
	let high = offsets.length - 2;
	while (low < high) {
		const mid = (low + high + 1) >> 1;
		if ((offsets[mid] ?? 0) <= value) low = mid;
		else high = mid - 1;
	}
	return low;
}

/** Variable-height counterpart of `computeWindow`. */
export function computeVariableWindow(options: VariableWindowOptions): VirtualWindow {
	const { offsets, viewportHeight, overscan = DEFAULT_OVERSCAN } = options;
	const itemCount = offsets.length - 1;
	if (itemCount <= 0) return { start: 0, end: 0 };

	const total = offsets[itemCount] ?? 0;
	const scrollTop = Math.min(Math.max(0, options.scrollTop), Math.max(0, total - viewportHeight));
	const bottom = scrollTop + viewportHeight;

	const first = rowAt(offsets, scrollTop);
	let last = rowAt(offsets, bottom);
	// A row that starts exactly at the bottom edge is not visible.
	if (last > first && (offsets[last] ?? 0) >= bottom) last -= 1;

	return {
		start: Math.max(0, first - overscan),
		end: Math.min(itemCount, last + 1 + overscan)
	};
}
