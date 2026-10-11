// MIT License — Svelte 5 port of Extend UI xlsx-viewer. Upstream: extend-hq/ui (MIT).
// Keyboard navigation shared by the XLSX viewer and editor grids, following
// upstream react-xlsx's handleGridKeyDown: arrows, Ctrl/Cmd+arrows, Home/End,
// PageUp/PageDown (Alt for columns), Tab/Shift+Tab, and Enter/Shift+Enter.
// Moves clamp to the sheet. Pure and framework-free.

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
	const command = event.ctrlKey || event.metaKey;
	const { row, col } = current;
	let next: GridPosition;
	switch (event.key) {
		case 'ArrowDown':
			next = { row: command ? lastRow : row + 1, col };
			break;
		case 'ArrowUp':
			next = { row: command ? 0 : row - 1, col };
			break;
		case 'ArrowRight':
			next = { row, col: command ? lastCol : col + 1 };
			break;
		case 'ArrowLeft':
			next = { row, col: command ? 0 : col - 1 };
			break;
		case 'Home':
			next = { row: command ? 0 : row, col: 0 };
			break;
		case 'End':
			next = { row: command ? lastRow : row, col: lastCol };
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
