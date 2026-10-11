// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Unit tests for the shared grid keyboard navigation: run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import { navigateGrid, type GridKey } from './grid-navigation.js';

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
