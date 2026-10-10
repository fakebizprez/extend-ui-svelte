// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
// Workbook export for the XLSX editor: edited grids back to .xlsx bytes via
// SheetJS, plus a browser download trigger. SheetJS is loaded with a dynamic
// import so it only loads on the client.
import { evaluateCell } from './formulas.js';

/** One editable sheet: its name plus raw grid values (`=...` strings are formulas). */
export interface EditableSheet {
	name: string;
	grid: (string | number | boolean | null)[][];
}

/**
 * Serializes edited sheets to .xlsx bytes. Strings starting with `=` are
 * stored as real formulas ({ f }) so spreadsheet apps evaluate them on open.
 * Rejects with a clear error when no sheets are given.
 */
export async function sheetsToXlsxBytes(sheets: EditableSheet[]): Promise<Uint8Array> {
	if (sheets.length === 0) {
		throw new Error('Cannot export a workbook without sheets: at least one sheet is required.');
	}

	const XLSX = await import('xlsx');
	const workbook = XLSX.utils.book_new();
	for (const sheet of sheets) {
		const grid = sheet.grid.length === 0 ? [[]] : sheet.grid;
		const worksheet = XLSX.utils.aoa_to_sheet(grid);
		// aoa_to_sheet writes formula strings as literal text; rewrite them as
		// formula cells so Excel/LibreOffice evaluate them. The SheetJS writer
		// drops formula cells without a cached value, so evaluate locally.
		for (let row = 0; row < grid.length; row += 1) {
			const gridRow = grid[row] ?? [];
			for (let col = 0; col < gridRow.length; col += 1) {
				const value = gridRow[col];
				if (typeof value === 'string' && value.startsWith('=') && value.length > 1) {
					const address = XLSX.utils.encode_cell({ r: row, c: col });
					const cached = evaluateCell(
						value,
						(r, c) => (grid[r] ?? [])[c] ?? null
					);
					worksheet[address] =
						typeof cached === 'number'
							? { t: 'n', v: cached, f: value.slice(1) }
							: { t: 's', v: String(cached ?? ''), f: value.slice(1) };
				}
			}
		}
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
