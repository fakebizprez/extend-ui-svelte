// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Workbook export for the XLSX editor: edited grids back to .xlsx bytes via
// SheetJS, plus a browser download trigger. SheetJS is loaded with a dynamic
// import so it only loads on the client.
import { XLSX_ERROR_CODES, XlsxCellError } from '../../engines/xlsx/xlsx.js';
import type { CellValue } from './formulas.js';

/** One editable sheet: cell values plus its formula cells. */
export interface EditableSheet {
	name: string;
	/**
	 * Cell values by zero-based row and column. For a formula cell this is the
	 * result to save with it. Text starting with `=` is text, not a formula.
	 */
	grid: CellValue[][];
	/** Formula text without the leading `=`, keyed by zero-based `row:col`. */
	formulas?: Record<string, string>;
}

type SheetCell = { t: 'n' | 's' | 'b' | 'e'; v: number | string | boolean; w?: string; f?: string };

/** A SheetJS cell keeping the value's type: number, text, boolean, or error. */
function toSheetCell(value: CellValue): SheetCell | null {
	if (value === null) return null;
	if (typeof value === 'number') return { t: 'n', v: value };
	if (typeof value === 'boolean') return { t: 'b', v: value };
	if (value instanceof XlsxCellError) {
		const code = XLSX_ERROR_CODES[value.code];
		// Errors Excel has no code for (e.g. #CIRC!) are saved as their text.
		return code === undefined ? { t: 's', v: value.code } : { t: 'e', v: code, w: value.code };
	}
	return { t: 's', v: value };
}

/**
 * Serializes edited sheets to .xlsx bytes, every cell at its own address.
 * Formula cells are written as real formulas ({ f }) with their result, so
 * spreadsheet apps show the value before recalculating. Rejects with a clear
 * error when no sheets are given.
 */
export async function sheetsToXlsxBytes(sheets: EditableSheet[]): Promise<Uint8Array> {
	if (sheets.length === 0) {
		throw new Error('Cannot export a workbook without sheets: at least one sheet is required.');
	}

	const XLSX = await import('xlsx');
	const workbook = XLSX.utils.book_new();
	for (const sheet of sheets) {
		const worksheet: Record<string, unknown> = {};
		let lastRow = 0;
		let lastCol = 0;
		const rowCount = sheet.grid.length;
		for (let row = 0; row < rowCount; row += 1) {
			const gridRow = sheet.grid[row] ?? [];
			for (let col = 0; col < gridRow.length; col += 1) {
				const formula = sheet.formulas?.[`${row}:${col}`];
				const value = gridRow[col] ?? null;
				// A formula cell needs a value for the SheetJS writer to keep it.
				const cell = formula !== undefined ? (toSheetCell(value) ?? { t: 's', v: '' }) : toSheetCell(value);
				if (!cell) continue;
				if (formula !== undefined) cell.f = formula;
				worksheet[XLSX.utils.encode_cell({ r: row, c: col })] = cell;
				lastRow = Math.max(lastRow, row);
				lastCol = Math.max(lastCol, col);
			}
		}
		worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
		XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
	}
	return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/**
 * Triggers a browser download of .xlsx bytes. Returns false (without throwing)
 * outside a browser DOM or when object URLs are unavailable, so editor hosts
 * can still receive the bytes through their own callback.
 */
export function downloadXlsxBytes(bytes: Uint8Array, fileName: string): boolean {
	if (typeof document === 'undefined') return false;
	if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
	try {
		const blob = new Blob(
			[
				bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
			],
			{ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
		);
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = fileName;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
		return true;
	} catch {
		// Non-browser DOMs (jsdom under Node) expose createObjectURL but reject
		// their own Blobs; report unavailable instead of throwing.
		return false;
	}
}
