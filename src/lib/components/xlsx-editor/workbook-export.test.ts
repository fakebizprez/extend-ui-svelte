// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Unit tests for the workbook export helper: run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import { read, utils } from 'xlsx';
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

	it('stores =strings as real formulas, not literal text', async () => {
		const bytes = await sheetsToXlsxBytes([
			{ name: 'Math', grid: [['Qty'], [10], [20], ['=SUM(A2:A3)']] }
		]);

		const workbook = read(bytes, { type: 'array' });
		const sheet = workbook.Sheets['Math'];
		expect(sheet['A4']).toMatchObject({ f: 'SUM(A2:A3)' });
		expect(sheet['A4'].v).not.toBe('=SUM(A2:A3)');
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
