// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).

/**
 * Framework-free review model for HumanReviewPanel: the upstream sample
 * fields, JSON value helpers, array drill-in paths, and the split JSON diff
 * that replaces upstream's @pierre/diffs view.
 */

import {
	formatCitationValue,
	getObjectValue,
	isJsonObject,
	type JsonArray,
	type JsonObject,
	type JsonPrimitive,
	type JsonValue,
	type ReviewField,
	type ReviewFieldSchema
} from './citations.js';

/** Upstream sample fields (bank statement), used when `fields` is omitted. */
export const REVIEW_FIELDS: ReviewField[] = [
	{
		key: 'statement_period',
		schema: {
			type: 'string',
			title: 'Statement period',
			description: 'Date range covered by the bank statement.'
		},
		actual: 'Jan 1-31, 2026',
		expected: 'January 1-31, 2026',
		location: { page: 1, area: { left: 31, top: 30, width: 40, height: 5.8 } }
	},
	{
		key: 'transactions',
		schema: {
			type: 'array',
			title: 'Transactions',
			description: 'Posted account activity during the statement period.',
			items: {
				type: 'object',
				properties: {
					date: { type: 'string', title: 'Date' },
					description: { type: 'string', title: 'Description' },
					amount: { type: 'number', title: 'Amount' },
					category: { type: 'string', title: 'Category' },
					merchant: {
						type: 'object',
						title: 'Merchant',
						properties: {
							name: { type: 'string', title: 'Name' },
							city: { type: 'string', title: 'City' },
							risk_level: { type: 'string', title: 'Risk level' }
						}
					},
					tags: { type: 'array', title: 'Tags', items: { type: 'string', title: 'Tag' } }
				}
			}
		},
		actual: [
			{
				date: '2026-01-03',
				description: 'ACH CREDIT PAYROLL',
				amount: 4250,
				category: 'Deposit',
				merchant: { name: 'Acme Payroll', city: 'New York', risk_level: 'low' },
				tags: ['payroll', 'recurring']
			},
			{
				date: '2026-01-12',
				description: 'POS PURCHASE GROCERY MART',
				amount: -86.42,
				category: 'Debit',
				merchant: { name: 'Grocery Mart', city: 'Brooklyn', risk_level: 'medium' },
				tags: ['card', 'groceries']
			}
		],
		expected: [
			{
				date: '2026-01-03',
				description: 'ACH CREDIT PAYROLL',
				amount: 4250,
				category: 'Deposit',
				merchant: { name: 'Acme Payroll', city: 'New York', risk_level: 'low' },
				tags: ['payroll', 'recurring']
			},
			{
				date: '2026-01-12',
				description: 'POS PURCHASE GROCERY MART',
				amount: -68.42,
				category: 'Debit',
				merchant: { name: 'Grocery Mart', city: 'Brooklyn', risk_level: 'low' },
				tags: ['card', 'groceries', 'needs_review']
			}
		],
		location: { page: 1, area: { left: 13.5, top: 66, width: 73.5, height: 7.5 } }
	},
	{
		key: 'ending_balance',
		schema: {
			type: 'number',
			title: 'Ending balance',
			description: 'Final account balance at the end of the statement period.'
		},
		actual: 12840.18,
		expected: 12858.18,
		location: { page: 1, area: { left: 13.5, top: 66, width: 73.5, height: 7.5 } }
	},
	{
		key: 'overdraft_protection_enabled',
		schema: {
			type: 'boolean',
			title: 'Overdraft protection enabled',
			description: 'Whether overdraft protection is enabled for the account.'
		},
		actual: false,
		expected: true,
		location: { page: 2, area: { left: 9.5, top: 12, width: 81, height: 11.5 } }
	},
	{
		key: 'account_details',
		schema: {
			type: 'object',
			title: 'Account details',
			description: 'Account owner and identifying details from the statement.',
			properties: {
				holder_name: { type: 'string', title: 'Holder name' },
				account_last_four: { type: 'string', title: 'Account last four' },
				account_type: { type: 'string', title: 'Account type' },
				mailing_address: {
					type: 'object',
					title: 'Mailing address',
					properties: {
						line_1: { type: 'string', title: 'Line 1' },
						city: { type: 'string', title: 'City' },
						state: { type: 'string', title: 'State' }
					}
				},
				linked_accounts: {
					type: 'array',
					title: 'Linked accounts',
					items: {
						type: 'object',
						properties: {
							nickname: { type: 'string', title: 'Nickname' },
							last_four: { type: 'string', title: 'Last four' }
						}
					}
				}
			}
		},
		actual: {
			holder_name: 'Jordan Lee',
			account_last_four: '4821',
			account_type: 'Checking',
			mailing_address: { line_1: '42 Market Street', city: 'Brooklyn', state: 'NY' },
			linked_accounts: [{ nickname: 'Operations reserve', last_four: '1842' }]
		},
		expected: {
			holder_name: 'Jordan Lee',
			account_last_four: '4821',
			account_type: 'Premier Checking',
			mailing_address: { line_1: '42 Market Street', city: 'New York', state: 'NY' },
			linked_accounts: [
				{ nickname: 'Operations reserve', last_four: '1842' },
				{ nickname: 'Payroll sweep', last_four: '9174' }
			]
		}
	}
];

/** One drill-in level of an array grid: the opened cell and its value. */
export interface ArrayNestedView {
	rowIndex: number;
	columnId: string;
	title: string;
	schema: ReviewFieldSchema;
	value: JsonValue;
}

/** Which grid of an array field a selection or drill-in came from. */
export type ArrayReviewSide = 'actual' | 'expected';

/** A grid column: an item property, or `value` for primitive items. */
export interface ArrayColumn {
	id: string;
	title: string;
	width: number;
}

export const formatValue = formatCitationValue;

export function valuesFromFields(
	fields: ReviewField[],
	valueKey: 'actual' | 'expected'
): JsonObject {
	const values: JsonObject = {};
	for (const field of fields) values[field.key] = field[valueKey];
	return values;
}

export function formatJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

export function isJsonArray(value: JsonValue): value is JsonArray {
	return Array.isArray(value);
}

export function setObjectValue(value: JsonValue, key: string, childValue: JsonValue): JsonObject {
	return { ...(isJsonObject(value) ? value : {}), [key]: childValue };
}

export function getArrayValue(value: JsonValue): JsonArray {
	return isJsonArray(value) ? value : [];
}

export function setArrayItemValue(value: JsonValue, index: number, childValue: JsonValue): JsonArray {
	const nextValue = getArrayValue(value).slice();
	nextValue[index] = childValue;
	return nextValue;
}

export function getPrimitiveValue(value: JsonValue): JsonPrimitive {
	return isJsonObject(value) || isJsonArray(value) ? null : value;
}

export function jsonValuesEqual(left: JsonValue, right: JsonValue): boolean {
	return formatJson(left) === formatJson(right);
}

export function getArrayItemSchema(schema: ReviewFieldSchema): ReviewFieldSchema {
	return schema.items ?? { type: 'string' };
}

export function isComplexSchema(schema: ReviewFieldSchema): boolean {
	return schema.type === 'object' || schema.type === 'array';
}

export function summarizeComplexValue(value: JsonValue): string {
	if (isJsonArray(value)) return `${value.length} items`;
	if (isJsonObject(value)) return `${Object.keys(value).length} fields`;
	return formatValue(value);
}

export function getCellValueForArrayColumn(
	rowValue: JsonValue,
	itemSchema: ReviewFieldSchema,
	columnId: string
): JsonValue {
	return itemSchema.type === 'object' ? getObjectValue(rowValue, columnId) : rowValue;
}

export function getCellSchemaForArrayColumn(
	itemSchema: ReviewFieldSchema,
	columnId: string
): ReviewFieldSchema {
	if (itemSchema.type === 'object') {
		return itemSchema.properties?.[columnId] ?? { type: 'string' };
	}
	return itemSchema;
}

/** Grid columns for an array's item schema, with upstream's column widths. */
export function getArrayColumns(itemSchema: ReviewFieldSchema): ArrayColumn[] {
	if (itemSchema.type === 'object') {
		const entries = Object.entries(itemSchema.properties ?? {});
		if (entries.length) {
			return entries.map(([key, propertySchema]) => ({
				id: key,
				title: propertySchema.title ?? key,
				width: isComplexSchema(propertySchema) ? 148 : 132
			}));
		}
	}
	return [
		{
			id: 'value',
			title: itemSchema.title ?? 'Value',
			width: isComplexSchema(itemSchema) ? 148 : 180
		}
	];
}

export function setNestedArrayValue({
	value,
	schema,
	nestedStack,
	nextNestedValue
}: {
	value: JsonValue;
	schema: ReviewFieldSchema;
	nestedStack: ArrayNestedView[];
	nextNestedValue: JsonValue;
}): JsonValue {
	const [currentView, ...remainingViews] = nestedStack;
	if (!currentView) return nextNestedValue;

	const itemSchema = getArrayItemSchema(schema);
	const rowValue = getArrayValue(value)[currentView.rowIndex] ?? null;
	const cellSchema = getCellSchemaForArrayColumn(itemSchema, currentView.columnId);
	const currentCellValue = getCellValueForArrayColumn(rowValue, itemSchema, currentView.columnId);
	const nextCellValue = remainingViews.length
		? setNestedArrayValue({
				value: currentCellValue,
				schema: cellSchema,
				nestedStack: remainingViews,
				nextNestedValue
			})
		: nextNestedValue;
	const nextRowValue =
		itemSchema.type === 'object'
			? setObjectValue(rowValue, currentView.columnId, nextCellValue)
			: nextCellValue;

	return setArrayItemValue(value, currentView.rowIndex, nextRowValue);
}

export function getNestedArrayValue({
	value,
	schema,
	nestedStack
}: {
	value: JsonValue;
	schema: ReviewFieldSchema;
	nestedStack: ArrayNestedView[];
}): JsonValue {
	const [currentView, ...remainingViews] = nestedStack;
	if (!currentView) return value;

	const itemSchema = getArrayItemSchema(schema);
	const rowValue = getArrayValue(value)[currentView.rowIndex] ?? null;
	const cellValue = getCellValueForArrayColumn(rowValue, itemSchema, currentView.columnId);
	if (!remainingViews.length) return cellValue;

	return getNestedArrayValue({
		value: cellValue,
		schema: getCellSchemaForArrayColumn(itemSchema, currentView.columnId),
		nestedStack: remainingViews
	});
}

/**
 * Converts edited cell text to a JSON value. Numbers that do not parse keep
 * the previous value, like upstream's number overlay editor.
 */
export function parseCellEdit(
	schema: ReviewFieldSchema,
	text: string,
	previous: JsonValue
): JsonValue {
	if (schema.type === 'number' || schema.type === 'integer') {
		const numericValue = Number(text);
		if (Number.isFinite(numericValue)) return numericValue;
		return typeof previous === 'number' ? previous : null;
	}
	return text;
}

export type DiffLineKind = 'context' | 'removed' | 'added';

export interface DiffSide {
	lineNumber: number;
	text: string;
	kind: DiffLineKind;
}

export type DiffLineRow = { type: 'line'; left?: DiffSide; right?: DiffSide };
export type DiffRow = DiffLineRow | { type: 'collapsed'; count: number; rows: DiffLineRow[] };

type DiffOp = { kind: DiffLineKind; oldLine?: number; newLine?: number; text: string };

// ponytail: quadratic LCS on the changed middle; past this many cells the
// middle is shown as one removed block plus one added block. Swap in Myers
// diff if outputs that large need line-level pairing.
const MAX_LCS_CELLS = 4_000_000;

function diffLines(a: string[], b: string[]): DiffOp[] {
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) start++;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
	}

	const ops: DiffOp[] = [];
	for (let i = 0; i < start; i++) {
		ops.push({ kind: 'context', oldLine: i + 1, newLine: i + 1, text: a[i] });
	}

	const n = endA - start;
	const m = endB - start;
	if (n * m > MAX_LCS_CELLS) {
		for (let i = start; i < endA; i++) ops.push({ kind: 'removed', oldLine: i + 1, text: a[i] });
		for (let j = start; j < endB; j++) ops.push({ kind: 'added', newLine: j + 1, text: b[j] });
	} else {
		const width = m + 1;
		const lengths = new Uint32Array((n + 1) * width);
		for (let i = n - 1; i >= 0; i--) {
			for (let j = m - 1; j >= 0; j--) {
				lengths[i * width + j] =
					a[start + i] === b[start + j]
						? lengths[(i + 1) * width + j + 1] + 1
						: Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
			}
		}
		let i = 0;
		let j = 0;
		while (i < n || j < m) {
			if (i < n && j < m && a[start + i] === b[start + j]) {
				ops.push({ kind: 'context', oldLine: start + i + 1, newLine: start + j + 1, text: a[start + i] });
				i++;
				j++;
			} else if (j >= m || (i < n && lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
				ops.push({ kind: 'removed', oldLine: start + i + 1, text: a[start + i] });
				i++;
			} else {
				ops.push({ kind: 'added', newLine: start + j + 1, text: b[start + j] });
				j++;
			}
		}
	}

	for (let k = 0; k < a.length - endA; k++) {
		ops.push({ kind: 'context', oldLine: endA + k + 1, newLine: endB + k + 1, text: a[endA + k] });
	}
	return ops;
}

/**
 * Split (side-by-side) line diff. Removed and added lines in one change block
 * pair up row by row; unchanged runs farther than `context` lines from a
 * change collapse into an expandable "unmodified lines" row.
 */
export function buildSplitDiff(oldText: string, newText: string, context = 3): DiffRow[] {
	const ops = diffLines(oldText.split('\n'), newText.split('\n'));
	const lines: DiffLineRow[] = [];
	let removed: DiffSide[] = [];
	let added: DiffSide[] = [];
	const flush = () => {
		for (let k = 0; k < Math.max(removed.length, added.length); k++) {
			lines.push({ type: 'line', left: removed[k], right: added[k] });
		}
		removed = [];
		added = [];
	};
	for (const op of ops) {
		if (op.kind === 'removed') {
			removed.push({ lineNumber: op.oldLine!, text: op.text, kind: 'removed' });
		} else if (op.kind === 'added') {
			added.push({ lineNumber: op.newLine!, text: op.text, kind: 'added' });
		} else {
			flush();
			lines.push({
				type: 'line',
				left: { lineNumber: op.oldLine!, text: op.text, kind: 'context' },
				right: { lineNumber: op.newLine!, text: op.text, kind: 'context' }
			});
		}
	}
	flush();

	const changed = lines.map((row) => row.left?.kind !== 'context' || row.right?.kind !== 'context');
	if (!changed.includes(true)) return lines;

	const near = changed.map((_, index) => {
		for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k++) {
			if (changed[k]) return true;
		}
		return false;
	});
	const rows: DiffRow[] = [];
	let hidden: DiffLineRow[] = [];
	lines.forEach((row, index) => {
		if (near[index]) {
			if (hidden.length) rows.push({ type: 'collapsed', count: hidden.length, rows: hidden });
			hidden = [];
			rows.push(row);
		} else {
			hidden.push(row);
		}
	});
	if (hidden.length) rows.push({ type: 'collapsed', count: hidden.length, rows: hidden });
	return rows;
}

export type JsonTokenKind = 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'plain';

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

/** Splits one line of formatted JSON into colorable tokens. */
export function tokenizeJsonLine(line: string): Array<{ text: string; kind: JsonTokenKind }> {
	const tokens: Array<{ text: string; kind: JsonTokenKind }> = [];
	let last = 0;
	for (const match of line.matchAll(JSON_TOKEN)) {
		const index = match.index ?? 0;
		if (index > last) tokens.push({ text: line.slice(last, index), kind: 'plain' });
		const [text, stringToken, numberToken, literalToken] = match;
		const kind: JsonTokenKind = stringToken
			? /^\s*:/.test(line.slice(index + text.length))
				? 'key'
				: 'string'
			: numberToken
				? 'number'
				: literalToken
					? 'literal'
					: 'punctuation';
		tokens.push({ text, kind });
		last = index + text.length;
	}
	if (last < line.length) tokens.push({ text: line.slice(last), kind: 'plain' });
	return tokens;
}

/** A grid cell address: `[column, row]`, like glide-data-grid's `Item`. */
export type GridItem = [column: number, row: number];
