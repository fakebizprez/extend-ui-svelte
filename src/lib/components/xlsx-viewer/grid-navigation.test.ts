// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Unit tests for the shared grid keyboard navigation: run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import { navigateGrid, usedRange, type GridKey } from './grid-navigation.js';

// A 10-row by 4-column sheet; a page is 3 rows or 2 columns.
const BOUNDS = { rowCount: 10, colCount: 4, pageRows: 3, pageCols: 2 };
const at = (row: number, col: number) => ({ row, col });
const key = (name: string, mods: Partial<GridKey> = {}): GridKey => ({
	key: name,
	shiftKey: false,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	...mods
});

describe('navigateGrid (upstream react-xlsx keys)', () => {
	it('moves one cell with the arrows and clamps at the edges', () => {
		expect(navigateGrid(key('ArrowDown'), at(2, 1), BOUNDS)).toEqual(at(3, 1));
		expect(navigateGrid(key('ArrowUp'), at(2, 1), BOUNDS)).toEqual(at(1, 1));
		expect(navigateGrid(key('ArrowRight'), at(2, 1), BOUNDS)).toEqual(at(2, 2));
		expect(navigateGrid(key('ArrowLeft'), at(2, 1), BOUNDS)).toEqual(at(2, 0));
		expect(navigateGrid(key('ArrowUp'), at(0, 0), BOUNDS)).toEqual(at(0, 0));
		expect(navigateGrid(key('ArrowRight'), at(9, 3), BOUNDS)).toEqual(at(9, 3));
	});

	it('jumps to the edge of the sheet with Ctrl or Cmd plus an arrow', () => {
		expect(navigateGrid(key('ArrowDown', { ctrlKey: true }), at(2, 1), BOUNDS)).toEqual(at(9, 1));
		expect(navigateGrid(key('ArrowUp', { metaKey: true }), at(2, 1), BOUNDS)).toEqual(at(0, 1));
		expect(navigateGrid(key('ArrowRight', { ctrlKey: true }), at(2, 1), BOUNDS)).toEqual(at(2, 3));
		expect(navigateGrid(key('ArrowLeft', { metaKey: true }), at(2, 1), BOUNDS)).toEqual(at(2, 0));
	});

	it('goes to the row ends with Home and End, and the sheet corners with Ctrl', () => {
		expect(navigateGrid(key('Home'), at(5, 2), BOUNDS)).toEqual(at(5, 0));
		expect(navigateGrid(key('End'), at(5, 1), BOUNDS)).toEqual(at(5, 3));
		expect(navigateGrid(key('Home', { ctrlKey: true }), at(5, 2), BOUNDS)).toEqual(at(0, 0));
		expect(navigateGrid(key('End', { metaKey: true }), at(5, 1), BOUNDS)).toEqual(at(9, 3));
	});

	it('pages rows with PageUp and PageDown, and columns with Alt', () => {
		expect(navigateGrid(key('PageDown'), at(1, 1), BOUNDS)).toEqual(at(4, 1));
		expect(navigateGrid(key('PageUp'), at(1, 1), BOUNDS)).toEqual(at(0, 1));
		expect(navigateGrid(key('PageDown', { altKey: true }), at(1, 1), BOUNDS)).toEqual(at(1, 3));
		expect(navigateGrid(key('PageUp', { altKey: true }), at(1, 3), BOUNDS)).toEqual(at(1, 1));
	});

	it('moves along the row with Tab and Shift+Tab, wrapping between rows', () => {
		expect(navigateGrid(key('Tab'), at(2, 1), BOUNDS)).toEqual(at(2, 2));
		expect(navigateGrid(key('Tab'), at(2, 3), BOUNDS)).toEqual(at(3, 0));
		expect(navigateGrid(key('Tab', { shiftKey: true }), at(2, 1), BOUNDS)).toEqual(at(2, 0));
		expect(navigateGrid(key('Tab', { shiftKey: true }), at(2, 0), BOUNDS)).toEqual(at(1, 3));
	});

	it('moves down with Enter and up with Shift+Enter; modified Enter stays', () => {
		expect(navigateGrid(key('Enter'), at(2, 1), BOUNDS)).toEqual(at(3, 1));
		expect(navigateGrid(key('Enter', { shiftKey: true }), at(2, 1), BOUNDS)).toEqual(at(1, 1));
		expect(navigateGrid(key('Enter', { ctrlKey: true }), at(2, 1), BOUNDS)).toEqual(at(2, 1));
	});

	it('returns null for keys that do not navigate', () => {
		expect(navigateGrid(key('a'), at(2, 1), BOUNDS)).toBeNull();
		expect(navigateGrid(key('Delete'), at(2, 1), BOUNDS)).toBeNull();
		expect(navigateGrid(key('F2'), at(2, 1), BOUNDS)).toBeNull();
	});
});

describe('navigateGrid with a used range (upstream resolveFirst/LastUsedVisibleIndex)', () => {
	// A 10-row by 6-column grid whose data sits in C3:D5.
	const USED = { ...BOUNDS, colCount: 6, used: { firstRow: 2, lastRow: 4, firstCol: 2, lastCol: 3 } };

	it('goes to the corners of the used range with Ctrl+Home and Ctrl+End', () => {
		expect(navigateGrid(key('Home', { ctrlKey: true }), at(7, 5), USED)).toEqual(at(2, 2));
		expect(navigateGrid(key('End', { metaKey: true }), at(0, 0), USED)).toEqual(at(4, 3));
	});

	it('goes to the first and last used column with Home and End', () => {
		expect(navigateGrid(key('Home'), at(3, 5), USED)).toEqual(at(3, 2));
		expect(navigateGrid(key('End'), at(3, 0), USED)).toEqual(at(3, 3));
	});

	it('jumps to the used edges with Ctrl or Cmd plus an arrow', () => {
		expect(navigateGrid(key('ArrowUp', { ctrlKey: true }), at(8, 3), USED)).toEqual(at(2, 3));
		expect(navigateGrid(key('ArrowDown', { ctrlKey: true }), at(0, 3), USED)).toEqual(at(4, 3));
		expect(navigateGrid(key('ArrowLeft', { metaKey: true }), at(3, 5), USED)).toEqual(at(3, 2));
		expect(navigateGrid(key('ArrowRight', { metaKey: true }), at(3, 0), USED)).toEqual(at(3, 3));
	});

	it('keeps plain arrows free to leave the used range', () => {
		expect(navigateGrid(key('ArrowUp'), at(2, 2), USED)).toEqual(at(1, 2));
		expect(navigateGrid(key('ArrowRight'), at(2, 3), USED)).toEqual(at(2, 4));
	});
});

describe('usedRange', () => {
	it('finds the rows and columns that hold values', () => {
		const values = [
			[null, null, null, null],
			[null, null, null, null],
			[null, null, 'x', null],
			[null, null, null, 4],
			[null, null, '', null]
		];
		expect(usedRange(values)).toEqual({ firstRow: 2, lastRow: 3, firstCol: 2, lastCol: 3 });
	});

	it('counts extra used cells such as formulas with no saved value', () => {
		expect(usedRange([[null, null], [null, null]], ['1:0'])).toEqual({
			firstRow: 1,
			lastRow: 1,
			firstCol: 0,
			lastCol: 0
		});
	});

	it('is undefined for a sheet with no values', () => {
		expect(usedRange([[null], ['']])).toBeUndefined();
	});
});
