// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Unit tests for the XLSX engine wrapper: run in the Vitest node project.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	listSheetNames,
	loadWorkbookFromBytes,
	loadWorkbookFromUrl,
	sheetToGrid,
	sheetToRows,
	XlsxCellError
} from './xlsx.js';
import { utils, write } from 'xlsx';

const FIXTURE_PATH = join(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', 'sample.xlsx');

function fixtureBytes(): Uint8Array {
	return new Uint8Array(readFileSync(FIXTURE_PATH));
}

describe('xlsx engine', () => {
	it('loads a workbook from bytes and lists its sheet names', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());

		expect(listSheetNames(workbook)).toEqual(['Inventory', 'Summary', 'Notes', 'Lanes', 'Checks']);
	});

	it('loads a workbook from a URL', async () => {
		const base64 = Buffer.from(fixtureBytes()).toString('base64');
		const workbook = await loadWorkbookFromUrl(`data:application/octet-stream;base64,${base64}`);

		expect(listSheetNames(workbook)).toEqual(['Inventory', 'Summary', 'Notes', 'Lanes', 'Checks']);
	});

	it('converts a sheet to rows with sheet_to_json', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());
		const rows = await sheetToRows(workbook, 'Inventory');

		expect(rows).toHaveLength(5);
		expect(rows[0]).toEqual({ SKU: 'A-9001', Item: 'Resistor kit', Qty: 120, Warehouse: 'Reno' });
		expect(rows[4]).toEqual({ SKU: 'A-9005', Item: 'Multimeter', Qty: 42, Warehouse: 'Reno' });
	});

	it('converts every fixture sheet with the expected row counts', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());

		expect(await sheetToRows(workbook, 'Inventory')).toHaveLength(5);
		expect(await sheetToRows(workbook, 'Summary')).toHaveLength(2);
		expect(await sheetToRows(workbook, 'Notes')).toHaveLength(3);
	});

	it('keeps numeric cells numeric', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());
		const rows = await sheetToRows(workbook, 'Summary');

		expect(rows).toEqual([
			{ Metric: 'Total SKUs', Value: 5 },
			{ Metric: 'Total units', Value: 787 }
		]);
	});

	it('reads a sheet as a grid from A1 with the first row as data', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());
		const grid = await sheetToGrid(workbook, 'Inventory');

		expect(grid.values).toHaveLength(6);
		expect(grid.values[0]).toEqual(['SKU', 'Item', 'Qty', 'Warehouse']);
		expect(grid.values[1]).toEqual(['A-9001', 'Resistor kit', 120, 'Reno']);
	});

	it('keeps true cell positions: A1 origin and blank rows', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());
		const { values } = await sheetToGrid(workbook, 'Lanes');

		// The sheet's used range is B2:D6; the grid still starts at A1.
		expect(values).toHaveLength(6);
		expect(values[0]).toEqual([null, null, null, null]);
		expect(values[1]).toEqual([null, 'Lane', 'Loads', 'Miles']);
		expect(values[3]).toEqual([null, null, null, null]);
		expect(values[5]).toEqual([null, 'Total', 7, 3300]);
	});

	it('returns formulas by position next to their cached values', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());

		const lanes = await sheetToGrid(workbook, 'Lanes');
		expect(lanes.formulas).toEqual({ '5:2': 'SUM(C3:C5)', '5:3': 'SUM(D3:D5)' });
		const summary = await sheetToGrid(workbook, 'Summary');
		expect(summary.formulas['2:1']).toBe('SUM(Inventory!C2:C6)');
		expect(summary.values[2]).toEqual(['Total units', 787]);
	});

	it('reads error cells as typed errors that show their code', async () => {
		const book = utils.book_new();
		utils.book_append_sheet(
			book,
			{ '!ref': 'A1:B1', A1: { t: 'e', v: 7 }, B1: { t: 'e', v: 0x2a, f: 'NA()' } },
			'Errors'
		);
		const workbook = await loadWorkbookFromBytes(
			new Uint8Array(write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
		);
		const { values, formulas } = await sheetToGrid(workbook, 'Errors');

		expect(values[0]).toEqual([new XlsxCellError('#DIV/0!'), new XlsxCellError('#N/A')]);
		expect(String(values[0]?.[0])).toBe('#DIV/0!');
		expect(formulas).toEqual({ '0:1': 'NA()' });
	});

	it('reads an empty sheet as an empty grid', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());
		workbook.Sheets['Inventory'] = {};

		expect(await sheetToGrid(workbook, 'Inventory')).toEqual({ values: [], formulas: {} });
		await expect(sheetToGrid(workbook, 'Missing')).rejects.toThrow('Unknown sheet: "Missing"');
	});

	it('throws a clear error for an unknown sheet', async () => {
		const workbook = await loadWorkbookFromBytes(fixtureBytes());

		await expect(sheetToRows(workbook, 'Missing')).rejects.toThrow('Unknown sheet: "Missing"');
	});

	it('throws a clear error for empty input', async () => {
		await expect(loadWorkbookFromBytes(new Uint8Array(0))).rejects.toThrow(
			'Cannot load workbook from empty data'
		);
	});
});
