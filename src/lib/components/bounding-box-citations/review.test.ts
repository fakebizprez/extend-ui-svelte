// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import type { ArrayNestedView } from './review.js';
import {
	REVIEW_FIELDS,
	buildSplitDiff,
	getArrayColumns,
	getNestedArrayValue,
	parseCellEdit,
	setNestedArrayValue,
	summarizeComplexValue,
	tokenizeJsonLine,
	valuesFromFields
} from './review.js';

const transactions = REVIEW_FIELDS.find((field) => field.key === 'transactions')!;

describe('REVIEW_FIELDS', () => {
	it('copies the upstream sample fields in order', () => {
		expect(REVIEW_FIELDS.map((field) => field.key)).toEqual([
			'statement_period',
			'transactions',
			'ending_balance',
			'overdraft_protection_enabled',
			'account_details'
		]);
		const account = REVIEW_FIELDS[4];
		expect(Object.keys(account.schema.properties ?? {})).toEqual([
			'holder_name',
			'account_last_four',
			'account_type',
			'mailing_address',
			'linked_accounts'
		]);
		expect(REVIEW_FIELDS[0].location).toEqual({
			page: 1,
			area: { left: 31, top: 30, width: 40, height: 5.8 }
		});
	});
});

describe('valuesFromFields', () => {
	it('maps each field key to its actual or expected value', () => {
		const actual = valuesFromFields(REVIEW_FIELDS, 'actual');
		const expected = valuesFromFields(REVIEW_FIELDS, 'expected');
		expect(actual.ending_balance).toBe(12840.18);
		expect(expected.ending_balance).toBe(12858.18);
		expect(Object.keys(actual)).toHaveLength(5);
	});
});

describe('getArrayColumns', () => {
	it('builds one column per object property with upstream widths', () => {
		const columns = getArrayColumns(transactions.schema.items!);
		expect(columns.map((column) => column.id)).toEqual([
			'date',
			'description',
			'amount',
			'category',
			'merchant',
			'tags'
		]);
		expect(columns[0]).toEqual({ id: 'date', title: 'Date', width: 132 });
		expect(columns[4].width).toBe(148);
	});

	it('uses a single value column for primitive items', () => {
		expect(getArrayColumns({ type: 'string', title: 'Tag' })).toEqual([
			{ id: 'value', title: 'Tag', width: 180 }
		]);
		expect(getArrayColumns({ type: 'string' })[0].title).toBe('Value');
	});
});

describe('nested array values', () => {
	const merchantView: ArrayNestedView = {
		rowIndex: 1,
		columnId: 'merchant',
		title: 'Merchant / row 2',
		schema: transactions.schema.items!.properties!.merchant,
		value: null
	};

	it('reads the value under a drill-in stack', () => {
		expect(
			getNestedArrayValue({
				value: transactions.actual,
				schema: transactions.schema,
				nestedStack: [merchantView]
			})
		).toEqual({ name: 'Grocery Mart', city: 'Brooklyn', risk_level: 'medium' });
	});

	it('writes a nested value without mutating the source', () => {
		const next = setNestedArrayValue({
			value: transactions.actual,
			schema: transactions.schema,
			nestedStack: [merchantView],
			nextNestedValue: { name: 'Grocery Mart', city: 'Brooklyn', risk_level: 'low' }
		});
		expect((next as Array<Record<string, unknown>>)[1].merchant).toEqual({
			name: 'Grocery Mart',
			city: 'Brooklyn',
			risk_level: 'low'
		});
		expect(
			(transactions.actual as Array<Record<string, { risk_level: string }>>)[1].merchant
				.risk_level
		).toBe('medium');
	});

	it('returns the replacement when the stack is empty', () => {
		expect(
			setNestedArrayValue({
				value: [1],
				schema: { type: 'array' },
				nestedStack: [],
				nextNestedValue: [2]
			})
		).toEqual([2]);
	});
});

describe('parseCellEdit', () => {
	it('parses numbers and keeps the previous value for non-numeric input', () => {
		expect(parseCellEdit({ type: 'number' }, '-68.42', -86.42)).toBe(-68.42);
		expect(parseCellEdit({ type: 'number' }, 'abc', -86.42)).toBe(-86.42);
		expect(parseCellEdit({ type: 'integer' }, 'abc', null)).toBeNull();
	});

	it('keeps strings as typed', () => {
		expect(parseCellEdit({ type: 'string' }, 'Deposit ', 'x')).toBe('Deposit ');
	});
});

describe('summarizeComplexValue', () => {
	it('summarizes arrays and objects like upstream', () => {
		expect(summarizeComplexValue(['a', 'b'])).toBe('2 items');
		expect(summarizeComplexValue({ a: 1, b: 2, c: 3 })).toBe('3 fields');
		expect(summarizeComplexValue(null)).toBe('NULL');
	});
});

describe('buildSplitDiff', () => {
	it('pairs changed lines side by side', () => {
		const rows = buildSplitDiff('{\n  "a": 1\n}', '{\n  "a": 2\n}');
		expect(rows).toHaveLength(3);
		expect(rows[1]).toEqual({
			type: 'line',
			left: { lineNumber: 2, text: '  "a": 1', kind: 'removed' },
			right: { lineNumber: 2, text: '  "a": 2', kind: 'added' }
		});
		expect(rows[0]).toMatchObject({ type: 'line', left: { kind: 'context' } });
	});

	it('leaves the other side empty for pure additions', () => {
		const rows = buildSplitDiff('a\nc', 'a\nb\nc');
		expect(rows[1]).toEqual({
			type: 'line',
			left: undefined,
			right: { lineNumber: 2, text: 'b', kind: 'added' }
		});
	});

	it('collapses long unchanged runs away from changes', () => {
		const before = Array.from({ length: 20 }, (_, index) => `line ${index}`);
		const after = before.slice();
		after[10] = 'changed';
		const rows = buildSplitDiff(before.join('\n'), after.join('\n'), 3);
		const collapsed = rows.filter((row) => row.type === 'collapsed');
		expect(collapsed).toHaveLength(2);
		expect(collapsed[0]).toMatchObject({ count: 7 });
		expect(collapsed[1]).toMatchObject({ count: 6 });
		expect(rows.filter((row) => row.type === 'line')).toHaveLength(7);
	});

	it('shows every line when nothing changed', () => {
		const rows = buildSplitDiff('a\nb\nc\nd\ne\nf\ng\nh\ni', 'a\nb\nc\nd\ne\nf\ng\nh\ni');
		expect(rows.every((row) => row.type === 'line')).toBe(true);
		expect(rows).toHaveLength(9);
	});
});

describe('tokenizeJsonLine', () => {
	it('splits keys, strings, numbers, literals, and punctuation', () => {
		expect(tokenizeJsonLine('  "amount": -86.42,')).toEqual([
			{ text: '  ', kind: 'plain' },
			{ text: '"amount"', kind: 'key' },
			{ text: ': ', kind: 'plain' },
			{ text: '-86.42', kind: 'number' },
			{ text: ',', kind: 'punctuation' }
		]);
		expect(tokenizeJsonLine('"a": "b c", "d": null').map((token) => token.kind)).toEqual([
			'key',
			'plain',
			'string',
			'punctuation',
			'plain',
			'key',
			'plain',
			'literal'
		]);
	});
});
