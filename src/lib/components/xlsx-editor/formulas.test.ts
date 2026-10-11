// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Unit tests for the local formula evaluator: run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import { XlsxCellError } from '../../engines/xlsx/index.js';
import {
	columnIndexToLetter,
	columnLetterToIndex,
	createSheetEvaluator,
	evaluateCell,
	expandRange,
	parseCellRef,
	type CellGetter,
	type CellValue
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
		expect(String(evaluateCell('=BOGUSFN(B2)', get))).toBe('#NAME?');
		expect(String(evaluateCell('=SUM(', get))).toBe('#NAME?');
		expect(evaluateCell('=1/0', get)).toEqual(new XlsxCellError('#DIV/0!'));
		expect(String(evaluateCell('=NOSUCHCELL', get))).toBe('#NAME?');
	});

	it('returns zero for references outside the grid', () => {
		const get = getterFromGrid(GRID);
		expect(evaluateCell('=ZZZ999', get)).toBe(0);
		expect(evaluateCell('=SUM(Z100:Z101)', get)).toBe(0);
	});

	it('detects circular references instead of recursing forever', () => {
		const grid: (string | number | boolean | null)[][] = [['=B1', '=A1']];
		const get = getterFromGrid(grid);
		expect(String(evaluateCell('=A1', get))).toBe('#CIRC!');
	});
});

/** A sheet from literal values plus formulas keyed `row:col` (text without `=`). */
function sheet(
	values: CellValue[][],
	formulas: Record<string, string> = {},
	edited: string[] = []
) {
	return createSheetEvaluator({
		value: (row, col) => values[row]?.[col],
		formula: (row, col) => formulas[`${row}:${col}`],
		formulaKeys: () => Object.keys(formulas),
		edited: new Set(edited)
	});
}

describe('Excel range semantics', () => {
	// A1=10, B1=TRUE, A2="5" (text), B2=20
	const values: CellValue[][] = [
		[10, true],
		['5', 20]
	];
	const at = (formula: string) => sheet([...values, [null]], { '2:0': formula })(2, 0);

	it('ignores booleans and numeric text inside ranges', () => {
		expect(at('SUM(A1:B2)')).toBe(30);
		expect(at('COUNT(A1:B2)')).toBe(2);
		expect(at('AVERAGE(A1:B2)')).toBe(15);
		expect(at('MIN(A1:B2)')).toBe(10);
		expect(at('MAX(A1:B2)')).toBe(20);
		expect(at('PRODUCT(A1:B2)')).toBe(200);
	});

	it('treats a single referenced cell like a range', () => {
		expect(at('SUM(B1, A2)')).toBe(0);
		expect(at('COUNT(B1, A2, A1)')).toBe(1);
	});

	it('counts booleans and numeric text typed as direct arguments', () => {
		expect(at('SUM(1, TRUE, "3")')).toBe(5);
		expect(at('COUNT(1, TRUE, "3", "x")')).toBe(3);
		expect(at('SUM(B1+0, 1)')).toBe(2);
		expect(at('SUM(1, "x")')).toEqual(new XlsxCellError('#VALUE!'));
	});

	it('returns Excel results when no numbers are found', () => {
		expect(at('SUM(B1:B1)')).toBe(0);
		expect(at('MIN(B1:B1)')).toBe(0);
		expect(at('MAX(B1:B1)')).toBe(0);
		expect(at('PRODUCT(B1:B1)')).toBe(0);
		expect(at('COUNT(B1:B1)')).toBe(0);
		expect(at('AVERAGE(B1:B1)')).toEqual(new XlsxCellError('#DIV/0!'));
	});

	it('propagates errors from ranges except in COUNT', () => {
		const withError = sheet([[1, new XlsxCellError('#DIV/0!')], [null]], {
			'1:0': 'SUM(A1:B1)',
			'1:1': 'COUNT(A1:B1)'
		});
		expect(withError(1, 0)).toEqual(new XlsxCellError('#DIV/0!'));
		expect(withError(1, 1)).toBe(1);
	});

	it('coerces booleans and numeric text in arithmetic', () => {
		expect(at('A1+B1')).toBe(11);
		expect(at('A2+1')).toBe(6);
		expect(at('TRUE+TRUE')).toBe(2);
	});

	it('shows 0 for a formula that points at a blank cell', () => {
		expect(at('C9')).toBe(0);
	});
});

describe('sheet evaluator', () => {
	it('keeps text that starts with = as text, in the cell and in references', () => {
		const evaluate = sheet([['=abc', null]], { '0:1': 'A1' });
		expect(evaluate(0, 0)).toBe('=abc');
		expect(evaluate(0, 1)).toBe('=abc');
	});

	it("shows the file's saved value for an unedited formula", () => {
		// The saved value wins even where local evaluation would differ.
		const evaluate = sheet([[1, 2, 999]], { '0:2': 'SUM(A1:B1)' });
		expect(evaluate(0, 2)).toBe(999);
	});

	it('recalculates when an input is edited, including through other formulas', () => {
		const values: CellValue[][] = [[5, 6, 12, 99]];
		const formulas = { '0:1': 'A1+1', '0:2': 'B1*2', '0:3': 'SUM(C1:C1)' };
		expect(sheet(values, formulas)(0, 3)).toBe(99);
		const edited = sheet(values, formulas, ['0:0']);
		expect(edited(0, 1)).toBe(6);
		expect(edited(0, 2)).toBe(12);
		expect(edited(0, 3)).toBe(12);
		const edited2 = sheet([[10, 6, 12, 99]], formulas, ['0:0']);
		expect(edited2(0, 3)).toBe(22);
	});

	it('does not recalculate for edits outside a formula\'s inputs', () => {
		const evaluate = sheet([[1, 2, 999, 7]], { '0:2': 'SUM(A1:B1)' }, ['0:3']);
		expect(evaluate(0, 2)).toBe(999);
	});

	it('recalculates a formula that was itself re-entered', () => {
		const evaluate = sheet([[1, 2, 999]], { '0:2': 'SUM(A1:B1)' }, ['0:2']);
		expect(evaluate(0, 2)).toBe(3);
	});

	it('falls back to the saved value for formulas it cannot compute', () => {
		const cross = { '0:1': 'SUM(Inventory!C2:C6)' };
		expect(sheet([[1, 787]], cross)(0, 1)).toBe(787);
		expect(sheet([[1, 787]], cross, ['0:1'])(0, 1)).toEqual(new XlsxCellError('#NAME?'));
		expect(sheet([[1, null]], { '0:1': 'VLOOKUP(A1, A1:A1, 1)' })(0, 1)).toEqual(
			new XlsxCellError('#NAME?')
		);
	});

	it('keeps boolean and error results typed', () => {
		const evaluate = sheet([[true, new XlsxCellError('#N/A')]], { '0:0': 'X', '0:1': 'Y' });
		expect(evaluate(0, 0)).toBe(true);
		expect(evaluate(0, 1)).toEqual(new XlsxCellError('#N/A'));
		expect(sheet([[0, null]], { '0:1': '1/A1' }, ['0:1'])(0, 1)).toEqual(
			new XlsxCellError('#DIV/0!')
		);
	});
});
