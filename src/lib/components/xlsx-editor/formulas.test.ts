// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Unit tests for the local formula evaluator: run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import {
	columnIndexToLetter,
	columnLetterToIndex,
	evaluateCell,
	expandRange,
	parseCellRef,
	type CellGetter
} from './formulas.js';

function getterFromGrid(grid: (string | number | boolean | null)[][]): CellGetter {
	return (row, col) => grid[row]?.[col];
}

const GRID: (string | number | boolean | null)[][] = [
	['Item', 'Qty', 'Price'],
	['Resistor kit', 120, 2.5],
	['Capacitor set', 85, 4],
	['Multimeter', 42, 19.99]
];

describe('cell references', () => {
	it('parses A1 references to zero-based coordinates', () => {
		expect(parseCellRef('A1')).toEqual({ row: 0, col: 0 });
		expect(parseCellRef('B2')).toEqual({ row: 1, col: 1 });
		expect(parseCellRef('Z1')).toEqual({ row: 0, col: 25 });
		expect(parseCellRef('AA1')).toEqual({ row: 0, col: 26 });
		expect(parseCellRef('AB12')).toEqual({ row: 11, col: 27 });
	});

	it('accepts lowercase references', () => {
		expect(parseCellRef('b3')).toEqual({ row: 2, col: 1 });
	});

	it('rejects malformed references', () => {
		expect(parseCellRef('')).toBeNull();
		expect(parseCellRef('A')).toBeNull();
		expect(parseCellRef('1')).toBeNull();
		expect(parseCellRef('A0')).toBeNull();
		expect(parseCellRef('A1B2')).toBeNull();
		expect(parseCellRef('=A1')).toBeNull();
	});

	it('converts between column letters and indexes', () => {
		expect(columnLetterToIndex('A')).toBe(0);
		expect(columnLetterToIndex('Z')).toBe(25);
		expect(columnLetterToIndex('AA')).toBe(26);
		expect(columnIndexToLetter(0)).toBe('A');
		expect(columnIndexToLetter(25)).toBe('Z');
		expect(columnIndexToLetter(26)).toBe('AA');
		expect(columnIndexToLetter(27)).toBe('AB');
	});

	it('expands a range into every cell coordinate', () => {
		expect(expandRange('B2:B4')).toEqual([
			{ row: 1, col: 1 },
			{ row: 2, col: 1 },
			{ row: 3, col: 1 }
		]);
		expect(expandRange('A1:B2')).toHaveLength(4);
		expect(expandRange('bogus')).toBeNull();
		expect(expandRange('A1')).toBeNull();
	});
});

describe('evaluateCell', () => {
	it('returns plain values unchanged', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell(120, get)).toBe(120);
		expect(evaluateCell('Resistor kit', get)).toBe('Resistor kit');
		expect(evaluateCell(null, get)).toBe(null);
		expect(evaluateCell('', get)).toBe('');
	});

	it('evaluates a single cell reference', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=B2', get)).toBe(120);
		expect(evaluateCell('=A4', get)).toBe('Multimeter');
	});

	it('evaluates SUM over a range', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=SUM(B2:B4)', get)).toBe(247);
		expect(evaluateCell('=sum(B2:B4)', get)).toBe(247);
	});

	it('evaluates AVERAGE, MIN, MAX, COUNT, and PRODUCT', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=AVERAGE(B2:B4)', get)).toBeCloseTo(82.333, 2);
		expect(evaluateCell('=MIN(B2:B4)', get)).toBe(42);
		expect(evaluateCell('=MAX(B2:B4)', get)).toBe(340 - 220);
		expect(evaluateCell('=COUNT(B2:B4)', get)).toBe(3);
		expect(evaluateCell('=PRODUCT(B3:C3)', get)).toBe(340);
	});

	it('evaluates functions over argument lists', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=SUM(1, 2, 3)', get)).toBe(6);
		expect(evaluateCell('=SUM(B2, B3, 10)', get)).toBe(215);
		expect(evaluateCell('=AVERAGE(2, 4)', get)).toBe(3);
	});

	it('ignores text and blanks inside SUM ranges', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=SUM(A1:A4)', get)).toBe(0);
		expect(evaluateCell('=COUNT(A1:A4)', get)).toBe(0);
	});

	it('evaluates arithmetic with references and precedence', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=B2+B3', get)).toBe(205);
		expect(evaluateCell('=B2*2', get)).toBe(240);
		expect(evaluateCell('=1+2*3', get)).toBe(7);
		expect(evaluateCell('=(1+2)*3', get)).toBe(9);
		expect(evaluateCell('=C4*B4', get)).toBeCloseTo(839.58, 2);
	});

	it('evaluates nested formulas through references', () => {
		const grid: (string | number | boolean | null)[][] = [
			[10, '=A1*2', '=B1+5']
		];
		const get = getterFromGrid(grid);
		expect(evaluateCell('=C1', get)).toBe(25);
	});

	it('returns Excel-style errors for bad formulas', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=BOGUSFN(B2)', get)).toBe('#NAME?');
		expect(evaluateCell('=SUM(', get)).toBe('#ERROR');
		expect(evaluateCell('=1/0', get)).toBe('#DIV/0!');
		expect(evaluateCell('=NOSUCHCELL', get)).toBe('#NAME?');
	});

	it('returns zero for references outside the grid', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=ZZZ999', get)).toBe(0);
		expect(evaluateCell('=SUM(Z100:Z101)', get)).toBe(0);
	});

	it('detects circular references instead of recursing forever', () => {
		const grid: (string | number | boolean | null)[][] = [['=B1', '=A1']];
		const get = getterFromGrid(grid);
		expect(evaluateCell('=A1', get)).toBe('#CIRC!');
	});
});
