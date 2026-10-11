// MIT License — Svelte 5 port of Extend UI xlsx-viewer. Upstream: extend-hq/ui (MIT).
// Keyboard navigation shared by the XLSX viewer and editor grids, following
// upstream react-xlsx's handleGridKeyDown: arrows, Ctrl/Cmd+arrows, Home/End,
// PageUp/PageDown (Alt for columns), Tab/Shift+Tab, and Enter/Shift+Enter.
// Home/End and the Ctrl/Cmd jumps go to the used range's edges, as upstream's
// resolveFirstUsedVisibleIndex / resolveLastUsedVisibleIndex do. Moves clamp
// to the sheet. Pure apart from scrollCellIntoView.

export interface GridPosition {
	row: number;
	col: number;
}

export interface GridBounds {
	rowCount: number;
	colCount: number;
	/** Rows in one viewport, for PageUp/PageDown. */
	pageRows: number;
	/** Columns in one viewport, for Alt+PageUp/PageDown. */
	pageCols: number;
	/** Rows and columns holding data; the whole grid when omitted. */
	used?: UsedRange;
}

/** Zero-based inclusive bounds of the cells that hold data. */
export interface UsedRange {
	firstRow: number;
	lastRow: number;
	firstCol: number;
	lastCol: number;
}

/**
 * The rows and columns holding a value (blank strings count as empty), plus
 * `extraKeys` (`row:col`, e.g. formula cells). Undefined when nothing is used.
 */
export function usedRange(values: unknown[][], extraKeys: Iterable<string> = []): UsedRange | undefined {
	let range: UsedRange | undefined;
	const include = (row: number, col: number) => {
		if (!range) range = { firstRow: row, lastRow: row, firstCol: col, lastCol: col };
		range.firstRow = Math.min(range.firstRow, row);
		range.lastRow = Math.max(range.lastRow, row);
		range.firstCol = Math.min(range.firstCol, col);
		range.lastCol = Math.max(range.lastCol, col);
	};
	values.forEach((cells, row) =>
		cells.forEach((value, col) => {
			if (value !== null && value !== undefined && value !== '') include(row, col);
		})
	);
	for (const key of extraKeys) {
		const [row, col] = key.split(':').map(Number) as [number, number];
		include(row, col);
	}
	return range;
}

export type GridKey = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/**
 * The active cell after a navigation key, or null when the key does not
 * navigate. Shift+arrow moves the active cell (upstream extends a range).
 */
export function navigateGrid(
	event: GridKey,
	current: GridPosition,
	bounds: GridBounds
): GridPosition | null {
	const lastRow = bounds.rowCount - 1;
	const lastCol = bounds.colCount - 1;
	const used = bounds.used ?? { firstRow: 0, lastRow, firstCol: 0, lastCol };
	const command = event.ctrlKey || event.metaKey;
	const { row, col } = current;
	let next: GridPosition;
	switch (event.key) {
		case 'ArrowDown':
			next = { row: command ? used.lastRow : row + 1, col };
			break;
		case 'ArrowUp':
			next = { row: command ? used.firstRow : row - 1, col };
			break;
		case 'ArrowRight':
			next = { row, col: command ? used.lastCol : col + 1 };
			break;
		case 'ArrowLeft':
			next = { row, col: command ? used.firstCol : col - 1 };
			break;
		case 'Home':
			next = { row: command ? used.firstRow : row, col: used.firstCol };
			break;
		case 'End':
			next = { row: command ? used.lastRow : row, col: used.lastCol };
			break;
		case 'PageDown':
		case 'PageUp': {
			const direction = event.key === 'PageDown' ? 1 : -1;
			next = event.altKey
				? { row, col: col + direction * bounds.pageCols }
				: { row: row + direction * bounds.pageRows, col };
			break;
		}
		case 'Tab':
			next = event.shiftKey
				? col > 0
					? { row, col: col - 1 }
					: { row: row - 1, col: lastCol }
				: col < lastCol
					? { row, col: col + 1 }
					: { row: row + 1, col: 0 };
			break;
		case 'Enter':
			next =
				command || event.altKey
					? current
					: { row: event.shiftKey ? row - 1 : row + 1, col };
			break;
		default:
			return null;
	}
	return {
		row: Math.max(0, Math.min(next.row, lastRow)),
		col: Math.max(0, Math.min(next.col, lastCol))
	};
}

/** A printable key starts an edit with that character, as in upstream. */
export function isPrintableKey(event: GridKey): boolean {
	return event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
}

export interface GridMetrics {
	rowHeight: number;
	/** Height of the row viewport, used when it has not been laid out yet. */
	height: number;
	rowHeaderWidth: number;
	columnWidth: number;
}

/**
 * Scrolls a grid so a cell is in view: the shared VirtualList's viewport
 * (found inside `scroller`) vertically, and `scroller` itself horizontally.
 */
export function scrollCellIntoView(
	scroller: HTMLElement,
	cell: GridPosition,
	metrics: GridMetrics
): void {
	const viewport = scroller.querySelector<HTMLElement>('[data-testid="virtual-viewport"]');
	if (viewport) {
		const top = cell.row * metrics.rowHeight;
		const visible = viewport.clientHeight || metrics.height;
		let next = viewport.scrollTop;
		if (top < next) next = top;
		else if (top + metrics.rowHeight > next + visible) next = top + metrics.rowHeight - visible;
		if (next !== viewport.scrollTop) {
			viewport.scrollTop = next;
			// VirtualList windows rows from its scroll event; dispatch it so the
			// target row renders now (jsdom fires none for programmatic scrolls).
			viewport.dispatchEvent(new Event('scroll'));
		}
	}
	const width = scroller.clientWidth;
	if (width > 0) {
		const left = metrics.rowHeaderWidth + cell.col * metrics.columnWidth;
		if (left < scroller.scrollLeft + metrics.rowHeaderWidth) {
			scroller.scrollLeft = Math.max(0, left - metrics.rowHeaderWidth);
		} else if (left + metrics.columnWidth > scroller.scrollLeft + width) {
			scroller.scrollLeft = left + metrics.columnWidth - width;
		}
	}
}
