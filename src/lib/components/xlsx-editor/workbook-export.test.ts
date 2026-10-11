// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Unit tests for the workbook export helper: run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import { read, utils } from 'xlsx';
import { XlsxCellError } from '../../engines/xlsx/index.js';
import { downloadXlsxBytes, sheetsToXlsxBytes } from './workbook-export.js';

describe('sheetsToXlsxBytes', () => {
	it('writes edited grids back to a readable workbook', async () => {
		const bytes = await sheetsToXlsxBytes([
			{
				name: 'Inventory',
				grid: [
					['SKU', 'Item', 'Qty'],
					['A-9001', 'Resistor kit (edited)', 120],
					['A-9002', 'Capacitor set', 85]
				]
			}
		]);

		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.byteLength).toBeGreaterThan(0);

		const workbook = read(bytes, { type: 'array' });
		expect(workbook.SheetNames).toEqual(['Inventory']);
		const rows = utils.sheet_to_json(workbook.Sheets['Inventory'], { header: 1 });
		expect(rows[1]).toEqual(['A-9001', 'Resistor kit (edited)', 120]);
	});

	it('preserves every sheet in order', async () => {
		const bytes = await sheetsToXlsxBytes([
			{ name: 'First', grid: [['a', 1]] },
			{ name: 'Second', grid: [['b', 2]] }
		]);

		const workbook = read(bytes, { type: 'array' });
		expect(workbook.SheetNames).toEqual(['First', 'Second']);
	});

	it('writes formula cells with their result, and =text as text', async () => {
		const bytes = await sheetsToXlsxBytes([
			{
				name: 'Math',
				grid: [['Qty'], [10], [20], [30], ['=abc']],
				formulas: { '3:0': 'SUM(A2:A3)' }
			}
		]);

		const sheet = read(bytes, { type: 'array' }).Sheets['Math'];
		expect(sheet['A4']).toMatchObject({ t: 'n', v: 30, f: 'SUM(A2:A3)' });
		expect(sheet['A5']).toMatchObject({ t: 's', v: '=abc' });
		expect(sheet['A5'].f).toBeUndefined();
	});

	it('keeps boolean and error types for literals and formula results', async () => {
		const bytes = await sheetsToXlsxBytes([
			{
				name: 'Types',
				grid: [[true, new XlsxCellError('#N/A'), false, new XlsxCellError('#DIV/0!')]],
				formulas: { '0:2': '1=2', '0:3': '1/0' }
			}
		]);

		const sheet = read(bytes, { type: 'array' }).Sheets['Types'];
		expect(sheet['A1']).toMatchObject({ t: 'b', v: true });
		expect(sheet['B1']).toMatchObject({ t: 'e', w: '#N/A' });
		expect(sheet['C1']).toMatchObject({ t: 'b', v: false, f: '1=2' });
		expect(sheet['D1']).toMatchObject({ t: 'e', w: '#DIV/0!', f: '1/0' });
	});

	it('keeps numbers numeric and blanks blank', async () => {
		const bytes = await sheetsToXlsxBytes([
			{ name: 'Types', grid: [['n', 'blank'], [42, null]] }
		]);

		const workbook = read(bytes, { type: 'array' });
		const rows = utils.sheet_to_json<unknown[]>(workbook.Sheets['Types'], { header: 1 });
		expect(rows[1]?.[0]).toBe(42);
	});

	it('rejects an empty sheet list with a clear error', async () => {
		await expect(sheetsToXlsxBytes([])).rejects.toThrow('at least one sheet');
	});
});

describe('downloadXlsxBytes', () => {
	it('reports false outside a browser DOM', () => {
		expect(downloadXlsxBytes(new Uint8Array([1, 2, 3]), 'out.xlsx')).toBe(false);
	});
});
