// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
import { describe, expect, it } from 'vitest';
import { getMetadataLocation, type JsonObject } from '#lib/components/bounding-box-citations/index.js';
import {
	BLOCK_REVIEW_FIELDS,
	BLOCK_REVIEW_METADATA,
	resolveBlockReviewArrayItemMetadataPath
} from './block-demo.js';

const transactions = BLOCK_REVIEW_FIELDS[0];

describe('bank statement block demo data', () => {
	it('copies the upstream block fields in order', () => {
		expect(BLOCK_REVIEW_FIELDS.map((field) => field.key)).toEqual([
			'transactions',
			'account_details',
			'statement_period',
			'overdraft_protection_enabled'
		]);
		expect(BLOCK_REVIEW_FIELDS.every((field) => field.metadataPath === field.key)).toBe(true);
		expect(BLOCK_REVIEW_FIELDS[2].actual).toBe('Oct 01-31, 2021');
		expect(BLOCK_REVIEW_FIELDS[2].expected).toBe('October 01, 2021 through October 31, 2021');
	});

	it('adds the upstream nested samples and actual-value edits to the transactions', () => {
		const actual = transactions.actual as Array<Record<string, unknown>>;
		const expected = transactions.expected as Array<Record<string, unknown>>;
		expect(actual).toHaveLength(47);
		expect(expected[0].merchant).toEqual({
			name: expected[0].description,
			city: 'San Francisco',
			risk_level: 'review'
		});
		expect(expected[1].tags).toEqual(['card', 'retail', 'statement']);
		expect(actual[0].category).toBe('Card Activity');
		expect(actual[15].category).toBe('Retail Spend');
		expect(actual[28].category).toBe('Food & Dining');
		expect(actual[1]).toEqual(expected[1]);
	});

	it('resolves the statement period citation on page 1', () => {
		const location = getMetadataLocation(BLOCK_REVIEW_METADATA, 'statement_period');
		expect(location?.page).toBe(1);
		expect(location?.area.left).toBeCloseTo((358.956 / 612) * 100, 2);
		expect(location?.area.top).toBeCloseTo((46.4976 / 792) * 100, 2);
	});

	it('maps transaction rows to the citation whose reference text matches them', () => {
		const rows = transactions.actual as JsonObject[];
		expect(resolveBlockReviewArrayItemMetadataPath('transactions', 0, rows[0])).toBe(
			'transactions[0]'
		);
		expect(
			resolveBlockReviewArrayItemMetadataPath('transactions', 0, {
				date: '1999-01-01',
				description: 'Nothing like it',
				amount: 1
			})
		).toBeUndefined();
		expect(
			resolveBlockReviewArrayItemMetadataPath('account_details.linked_accounts', 2, null)
		).toBe('account_details.linked_accounts[2]');
	});

	it('finds a moved row by matching another citation', () => {
		const rows = transactions.actual as JsonObject[];
		expect(resolveBlockReviewArrayItemMetadataPath('transactions', 5, rows[0])).toBe(
			'transactions[0]'
		);
	});
});
