// MIT License — Svelte 5 port of Extend UI xlsx-editor. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type XlsxEditor from './XlsxEditor.svelte';

export { default as XlsxEditor } from './XlsxEditor.svelte';
/** Upstream React name. */
export { default as XlsxEditorPreview } from './XlsxEditor.svelte';
export { default } from './XlsxEditor.svelte';
export type XlsxEditorProps = ComponentProps<typeof XlsxEditor>;
export type {
	XlsxCellAlign,
	XlsxCellChange,
	XlsxCellStyle
} from './XlsxEditor.svelte';
export {
	columnIndexToLetter,
	columnLetterToIndex,
	evaluateCell,
	expandRange,
	parseCellRef,
	type CellCoord,
	type CellGetter,
	type CellValue
} from './formulas.js';
export {
	downloadXlsxBytes,
	sheetsToXlsxBytes,
	type EditableSheet
} from './workbook-export.js';
