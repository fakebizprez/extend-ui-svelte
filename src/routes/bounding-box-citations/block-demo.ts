// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
//
// Demo data for the block, ported from upstream
// apps/v4/components/bounding-box-citations-docs.tsx. `block-output.json`
// (upstream bounding-box-citations-block-output.json) holds the extraction
// output and its citations for the sample statement copied to
// static/fixtures/bank-statement-x4uhhi7t.pdf (upstream
// public/samples/bank-statement-x4uhhi7t.pdf). Both are from extend-hq/ui,
// MIT License, Copyright (c) 2026 CrowdView Inc, dba Extend.

import {
	isJsonObject,
	type JsonObject,
	type JsonValue,
	type ReviewCitation,
	type ReviewField,
	type ReviewMetadataEntry
} from '#lib/components/bounding-box-citations/citations.js';
import blockReviewOutput from './block-output.json';

export const BLOCK_REVIEW_PDF_URL = '/fixtures/bank-statement-x4uhhi7t.pdf';

type BlockTransaction = {
	date: string;
	amount: number;
	category: string;
	description: string;
	merchant?: { name: string; city: string; risk_level: string };
	tags?: string[];
};

type BlockCitation = ReviewCitation & { referenceText?: string };

const OUTPUT = blockReviewOutput as unknown as {
	value: {
		transactions: BlockTransaction[];
		ending_balance: number | null;
		account_details: Record<string, string | null>;
		statement_period: string;
		overdraft_protection_enabled: boolean | null;
	};
	metadata: Record<string, ReviewMetadataEntry & { citations?: BlockCitation[] }>;
};

// Every citation in the sample sits on page 1, the only page of the PDF, so
// upstream's source-to-local page mapping is the identity here.
export const BLOCK_REVIEW_METADATA = OUTPUT.metadata;
const EXPECTED_OUTPUT = OUTPUT.value;

const EXPECTED_TRANSACTIONS = EXPECTED_OUTPUT.transactions.map((transaction, index) => ({
	...transaction,
	merchant: {
		name: transaction.description,
		city: index % 2 === 0 ? 'San Francisco' : 'New York',
		risk_level: index % 3 === 0 ? 'review' : 'low'
	},
	tags: index % 2 === 0 ? ['posted', 'statement'] : ['card', 'retail', 'statement']
}));

const EXPECTED_ACCOUNT_DETAILS = {
	...EXPECTED_OUTPUT.account_details,
	mailing_address: { line_1: '270 Park Avenue', city: 'New York', state: 'NY' },
	linked_accounts: [
		{ nickname: 'Operating account', last_four: '8221' },
		{ nickname: 'Payroll reserve', last_four: '1294' }
	]
};

const ACTUAL_TRANSACTIONS = EXPECTED_TRANSACTIONS.map((transaction, index) => {
	if (index === 0) {
		return {
			...transaction,
			category: 'Card Activity',
			merchant: { ...transaction.merchant, risk_level: 'medium' },
			tags: ['posted', 'card_activity']
		};
	}
	if (index === 15) {
		return {
			...transaction,
			category: 'Retail Spend',
			merchant: { ...transaction.merchant, city: 'San Jose' },
			tags: ['card', 'retail', 'needs_review']
		};
	}
	if (index === 28) {
		return {
			...transaction,
			category: 'Food & Dining',
			merchant: { ...transaction.merchant, risk_level: 'review' }
		};
	}
	return transaction;
});

const ACTUAL_ACCOUNT_DETAILS = {
	...EXPECTED_ACCOUNT_DETAILS,
	account_type: 'Chase Business Checking',
	mailing_address: { ...EXPECTED_ACCOUNT_DETAILS.mailing_address, city: 'Brooklyn' },
	linked_accounts: [
		...EXPECTED_ACCOUNT_DETAILS.linked_accounts,
		{ nickname: 'Tax savings', last_four: '4402' }
	]
};

export const BLOCK_REVIEW_FIELDS: ReviewField[] = [
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
		actual: ACTUAL_TRANSACTIONS as JsonValue,
		expected: EXPECTED_TRANSACTIONS as JsonValue,
		metadataPath: 'transactions'
	},
	{
		key: 'account_details',
		schema: {
			type: 'object',
			title: 'Account details',
			description: 'Account owner and identifying details from the statement.',
			properties: {
				holder_name: { type: 'string', title: 'Holder name' },
				account_type: { type: 'string', title: 'Account type' },
				account_last_four: { type: 'string', title: 'Account last four' },
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
		actual: ACTUAL_ACCOUNT_DETAILS as JsonObject,
		expected: EXPECTED_ACCOUNT_DETAILS as JsonObject,
		metadataPath: 'account_details'
	},
	{
		key: 'statement_period',
		schema: {
			type: 'string',
			title: 'Statement period',
			description: 'Date range covered by the bank statement.'
		},
		actual: 'Oct 01-31, 2021',
		expected: EXPECTED_OUTPUT.statement_period,
		metadataPath: 'statement_period'
	},
	{
		key: 'overdraft_protection_enabled',
		schema: {
			type: 'boolean',
			title: 'Overdraft protection enabled',
			description: 'Whether overdraft protection is enabled for the account.'
		},
		actual: false,
		expected: EXPECTED_OUTPUT.overdraft_protection_enabled,
		metadataPath: 'overdraft_protection_enabled'
	}
];

function normalizeCitationSearchText(value: unknown): string {
	return String(value ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function getTransactionDateSearchText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	return match ? `${match[2]} ${match[3]}` : normalizeCitationSearchText(value);
}

function getNumberSearchTexts(value: unknown): string[] {
	if (typeof value !== 'number') return [];
	const absoluteValue = Math.abs(value);
	return [
		absoluteValue.toString(),
		absoluteValue.toFixed(2),
		absoluteValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
	].map(normalizeCitationSearchText);
}

function citationMatchesTransaction(citation: BlockCitation | undefined, transaction: JsonValue): boolean {
	if (!citation?.referenceText || !isJsonObject(transaction)) return false;
	const referenceText = normalizeCitationSearchText(citation.referenceText);
	const dateText = getTransactionDateSearchText(transaction.date);
	const descriptionText = normalizeCitationSearchText(transaction.description)
		.split(' ')
		.slice(0, 4)
		.join(' ');
	const amountTexts = getNumberSearchTexts(transaction.amount);
	return (
		Boolean(dateText && referenceText.includes(dateText)) &&
		Boolean(descriptionText && referenceText.includes(descriptionText)) &&
		amountTexts.some((amountText) => referenceText.includes(amountText))
	);
}

function firstCitation(path: string): BlockCitation | undefined {
	return BLOCK_REVIEW_METADATA[path]?.citations?.find((candidate) => candidate.polygon?.length);
}

/**
 * Maps a transactions row to the citation whose reference text matches its
 * date, description, and amount, so edited or reordered rows still point at
 * the right line. Ported from upstream `resolveBlockReviewArrayItemMetadataPath`.
 */
export function resolveBlockReviewArrayItemMetadataPath(
	metadataPath: string,
	rowIndex: number,
	rowValue: JsonValue
): string | undefined {
	if (metadataPath !== 'transactions') return `${metadataPath}[${rowIndex}]`;

	const rowMetadataPath = `${metadataPath}[${rowIndex}]`;
	if (citationMatchesTransaction(firstCitation(rowMetadataPath), rowValue)) return rowMetadataPath;

	return Object.keys(BLOCK_REVIEW_METADATA).find(
		(candidatePath) =>
			candidatePath.startsWith(`${metadataPath}[`) &&
			!candidatePath.includes('.') &&
			citationMatchesTransaction(firstCitation(candidatePath), rowValue)
	);
}
