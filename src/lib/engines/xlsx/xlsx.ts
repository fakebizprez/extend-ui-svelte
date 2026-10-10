// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// XLSX engine wrapper around SheetJS (the `xlsx` package). SheetJS is loaded
// with a dynamic import so it only loads on the client; call these functions
// from `onMount` or behind a `browser` guard.
import type { Sheet2JSONOpts, WorkBook } from 'xlsx';

/** One sheet row as returned by `sheet_to_json`: header names mapped to cell values. */
export type XlsxRow = Record<string, unknown>;

/** Options passed through to SheetJS `sheet_to_json`. */
export type XlsxSheetToRowsOptions = Sheet2JSONOpts;

async function loadSheetJs() {
	return await import('xlsx');
}

function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
	return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * Parses workbook bytes (fetched file, dropped file, or fixture) into a
 * SheetJS workbook. Rejects with a clear error when the input is empty.
 */
export async function loadWorkbookFromBytes(
	data: ArrayBuffer | Uint8Array
): Promise<WorkBook> {
	const bytes = toUint8Array(data);
	if (bytes.byteLength === 0) {
		throw new Error('Cannot load workbook from empty data.');
	}

	const XLSX = await loadSheetJs();
	return XLSX.read(bytes, { type: 'array' });
}

/**
 * Fetches a workbook URL and parses it. Works with same-origin fixture URLs
 * such as `/fixtures/sample.xlsx` as well as absolute URLs.
 */
export async function loadWorkbookFromUrl(url: string): Promise<WorkBook> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Cannot load workbook from "${url}": ${response.status} ${response.statusText}`.trim()
		);
	}
	return loadWorkbookFromBytes(await response.arrayBuffer());
}

/** Returns the workbook's sheet names in order. Pure and synchronous. */
export function listSheetNames(workbook: WorkBook): string[] {
	return [...(workbook.SheetNames ?? [])];
}

/**
 * Converts one sheet to row objects keyed by its first-row headers with
 * `sheet_to_json`. For an A1-addressed grid (what the viewer and editor
 * render), use `sheetToGrid`.
 * Blank cells default to `''` so every row carries the same keys; pass
 * `options` to override. Rejects with a clear error for an unknown sheet.
 */
export async function sheetToRows<T extends XlsxRow = XlsxRow>(
	workbook: WorkBook,
	sheetName: string,
	options: XlsxSheetToRowsOptions = {}
): Promise<T[]> {
	const worksheet = workbook.Sheets?.[sheetName];
	if (!worksheet) throw unknownSheetError(workbook, sheetName);

	const XLSX = await loadSheetJs();
	return XLSX.utils.sheet_to_json<T>(worksheet, { defval: '', ...options });
}

/** A sheet read cell by cell from A1, the way spreadsheet apps address it. */
export interface XlsxSheetGrid {
	/** Cell values (formula cells hold their cached result), blanks as null. */
	values: unknown[][];
	/** Formula text without the leading `=`, keyed by zero-based `row:col`. */
	formulas: Record<string, string>;
}

function unknownSheetError(workbook: WorkBook, sheetName: string): Error {
	const available = listSheetNames(workbook).join(', ') || '(no sheets)';
	return new Error(`Unknown sheet: "${sheetName}". Available sheets: ${available}.`);
}

/**
 * Reads one sheet as a grid anchored at A1: the first row is data (not
 * headers), blank rows and leading blank columns are kept, so `values[r][c]`
 * is the cell at row r+1, column c. Shared by the viewer and editor so both
 * show the same rows and A1 addresses.
 */
export async function sheetToGrid(workbook: WorkBook, sheetName: string): Promise<XlsxSheetGrid> {
	const worksheet = workbook.Sheets?.[sheetName];
	if (!worksheet) throw unknownSheetError(workbook, sheetName);
	if (!worksheet['!ref']) return { values: [], formulas: {} };

	const XLSX = await loadSheetJs();
	// The sheet's own range starts at its first used cell; widen it to A1.
	const used = XLSX.utils.decode_range(worksheet['!ref']);
	const range = { s: { r: 0, c: 0 }, e: used.e };
	const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
		header: 1,
		defval: null,
		blankrows: true,
		range
	});
	const formulas: Record<string, string> = {};
	for (let r = used.s.r; r <= used.e.r; r += 1) {
		for (let c = used.s.c; c <= used.e.c; c += 1) {
			const formula = worksheet[XLSX.utils.encode_cell({ r, c })]?.f;
			if (typeof formula === 'string' && formula) formulas[`${r}:${c}`] = formula;
		}
	}
	return { values, formulas };
}

/** Returns the number of data rows `sheetToRows` would return for a sheet. */
export async function getSheetRowCount(
	workbook: WorkBook,
	sheetName: string,
	options: XlsxSheetToRowsOptions = {}
): Promise<number> {
	return (await sheetToRows(workbook, sheetName, options)).length;
}
