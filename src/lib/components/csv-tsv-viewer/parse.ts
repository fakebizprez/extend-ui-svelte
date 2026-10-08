// MIT License — Svelte 5 port of Extend UI csv-viewer. Upstream: extend-hq/ui (MIT).
// Parsing logic ported from the React CsvViewer's parseDelimitedText: papaparse
// with header:true and greedy empty-line skipping, blank headers normalized to
// "Column N", and ragged rows padded into "Extra N" columns.

export interface ParsedTable {
	headers: string[];
	rows: string[][];
	error: string | null;
}

const EMPTY_TABLE: ParsedTable = { headers: [], rows: [], error: null };

function toDisplayString(value: unknown): string {
	return value === null || value === undefined ? '' : String(value);
}

function normalizeHeaderTitle(header: string, index: number): string {
	const trimmed = header.trim();
	return trimmed.length > 0 ? trimmed : `Column ${index + 1}`;
}

type ObjectRow = Record<string, unknown> & { __parsed_extra?: unknown };

/**
 * Parse CSV/TSV text into headers plus string rows. The delimiter is
 * auto-detected by papaparse unless an explicit one is given. papaparse is
 * loaded with a dynamic import so it only loads on the client.
 */
export async function parseDelimitedText(text: string, delimiter = ''): Promise<ParsedTable> {
	if (!text.trim()) return { ...EMPTY_TABLE };

	const { default: Papa } = await import('papaparse');
	const results = Papa.parse<ObjectRow>(text, {
		header: true,
		skipEmptyLines: 'greedy',
		...(delimiter ? { delimiter } : {})
	});

	const objectRows = Array.isArray(results.data)
		? results.data.filter(
				(row): row is ObjectRow => !!row && typeof row === 'object' && !Array.isArray(row)
			)
		: [];
	const metaFields = Array.isArray(results.meta.fields)
		? results.meta.fields.map((field) => String(field))
		: [];
	const fieldKeys =
		metaFields.length > 0
			? metaFields
			: Object.keys(objectRows[0] ?? {}).filter((key) => key !== '__parsed_extra');
	const extraColumnCount = objectRows.reduce((maxCount, row) => {
		const extras = row.__parsed_extra;
		return Array.isArray(extras) ? Math.max(maxCount, extras.length) : maxCount;
	}, 0);
	const headers = [
		...fieldKeys.map((field, index) => normalizeHeaderTitle(field, index)),
		...Array.from({ length: extraColumnCount }, (_, index) => `Extra ${index + 1}`)
	];

	const rows = objectRows.map((row) => {
		const baseValues = fieldKeys.map((fieldKey) => toDisplayString(row[fieldKey]));
		const extras = Array.isArray(row.__parsed_extra)
			? row.__parsed_extra.map((value) => toDisplayString(value))
			: [];
		const paddedExtras =
			extras.length >= extraColumnCount
				? extras.slice(0, extraColumnCount)
				: [
						...extras,
						...Array.from({ length: extraColumnCount - extras.length }, () => '')
					];

		return [...baseValues, ...paddedExtras];
	});

	const firstError =
		Array.isArray(results.errors) && results.errors.length > 0 ? results.errors[0] : null;

	return {
		headers,
		rows,
		error:
			rows.length === 0 && firstError
				? String(firstError.message ?? 'Could not parse CSV file.')
				: null
	};
}
