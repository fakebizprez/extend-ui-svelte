// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
export {
	getSheetRowCount,
	listSheetNames,
	loadWorkbookFromBytes,
	loadWorkbookFromUrl,
	sheetToRows,
	type XlsxRow,
	type XlsxSheetToRowsOptions
} from './xlsx.js';
export type { WorkBook } from 'xlsx';
