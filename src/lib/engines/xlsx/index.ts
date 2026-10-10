// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export {
	getSheetRowCount,
	listSheetNames,
	loadWorkbookFromBytes,
	loadWorkbookFromUrl,
	sheetToGrid,
	sheetToRows,
	type XlsxSheetGrid,
	type XlsxRow,
	type XlsxSheetToRowsOptions
} from './xlsx.js';
export type { WorkBook } from 'xlsx';
