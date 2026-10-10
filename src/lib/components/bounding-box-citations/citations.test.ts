// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
// Pure helper tests (no DOM): run in the Vitest node project.
import { describe, expect, it } from 'vitest';
import {
	boxesForPage,
	findReviewField,
	getCitationLocation,
	getMetadataLocation,
	getReviewFieldLocation,
	getReviewLocationKey,
	type ReviewField,
	type ReviewMetadataEntry
} from './citations.js';

const AREA = { left: 10, top: 20, width: 30, height: 5 };

function makeField(overrides: Partial<ReviewField> = {}): ReviewField {
	return {
		key: 'statement_period',
		schema: { type: 'string', title: 'Statement period' },
		actual: 'Jan 1-31, 2026',
		expected: 'January 1-31, 2026',
		...overrides
	};
}

describe('getCitationLocation', () => {
	it('converts a polygon to a percentage highlight area', () => {
		const location = getCitationLocation({
			page: 2,
			polygon: [
				{ x: 61.2, y: 158.4 },
				{ x: 550.8, y: 158.4 },
				{ x: 550.8, y: 217.8 },
				{ x: 61.2, y: 217.8 }
			],
			pageWidth: 612,
			pageHeight: 792
		});

		expect(location?.page).toBe(2);
		expect(location?.area.left).toBeCloseTo(10, 5);
		expect(location?.area.top).toBeCloseTo(20, 5);
		expect(location?.area.width).toBeCloseTo(80, 5);
		expect(location?.area.height).toBeCloseTo(7.5, 5);
	});

	it('returns undefined when the polygon or page size is missing', () => {
		expect(
			getCitationLocation({ page: 1, pageWidth: 612, pageHeight: 792 })
		).toBeUndefined();
		expect(
			getCitationLocation({ page: 1, polygon: [], pageWidth: 612, pageHeight: 792 })
		).toBeUndefined();
		expect(
			getCitationLocation({
				page: 1,
				polygon: [{ x: 1, y: 1 }],
				pageWidth: 0,
				pageHeight: 792
			})
		).toBeUndefined();
	});
});

describe('getMetadataLocation', () => {
	it('resolves the first cited polygon for a metadata path', () => {
		const metadata: Record<string, ReviewMetadataEntry> = {
			'account.holder': {
				citations: [
					{ page: 1, pageWidth: 612, pageHeight: 792 },
					{
						page: 3,
						polygon: [
							{ x: 61.2, y: 95.04 },
							{ x: 367.2, y: 166.32 }
						],
						pageWidth: 612,
						pageHeight: 792
					}
				]
			}
		};

		const location = getMetadataLocation(metadata, 'account.holder');
		expect(location?.page).toBe(3);
		expect(location?.area.left).toBeCloseTo(10, 5);
	});

	it('returns undefined for missing metadata or paths', () => {
		expect(getMetadataLocation(undefined, 'a.b')).toBeUndefined();
		expect(getMetadataLocation({}, undefined)).toBeUndefined();
		expect(getMetadataLocation({}, 'missing')).toBeUndefined();
		expect(getMetadataLocation({ a: {} }, 'a')).toBeUndefined();
	});
});

describe('getReviewFieldLocation', () => {
	it('prefers the inline field location', () => {
		const field = makeField({ location: { page: 1, area: AREA } });
		expect(getReviewFieldLocation(field, () => ({ page: 2, area: AREA }))).toEqual({
			page: 1,
			area: AREA
		});
	});

	it('falls back to the resolver with metadataPath then key', () => {
		const seen: string[] = [];
		const field = makeField({ metadataPath: 'custom.path' });
		const resolved = { page: 2, area: AREA };
		expect(
			getReviewFieldLocation(field, (path) => {
				seen.push(path);
				return resolved;
			})
		).toEqual(resolved);
		expect(seen).toEqual(['custom.path']);

		const byKey = makeField();
		expect(
			getReviewFieldLocation(byKey, (path) => {
				seen.push(path);
				return undefined;
			})
		).toBeUndefined();
		expect(seen).toEqual(['custom.path', 'statement_period']);
	});

	it('returns undefined for missing fields and resolvers', () => {
		expect(getReviewFieldLocation(undefined)).toBeUndefined();
		expect(getReviewFieldLocation(makeField())).toBeUndefined();
	});
});

describe('getReviewLocationKey', () => {
	it('builds a stable key for a location', () => {
		expect(getReviewLocationKey({ page: 1, area: AREA })).toBe('1:10:20:30:5');
	});

	it('returns null without a location', () => {
		expect(getReviewLocationKey(undefined)).toBeNull();
	});
});

describe('findReviewField', () => {
	it('finds top-level and nested object fields', () => {
		const fields: ReviewField[] = [
			makeField(),
			{
				key: 'account',
				schema: {
					type: 'object',
					properties: { holder: { type: 'string', title: 'Holder' } }
				},
				actual: { holder: 'Jordan' },
				expected: { holder: 'Jordan Lee' }
			}
		];

		expect(findReviewField(fields, 'statement_period')?.key).toBe('statement_period');
		const nested = findReviewField(fields, 'account.holder');
		expect(nested?.key).toBe('account.holder');
		expect(nested?.actual).toBe('Jordan');
		expect(nested?.expected).toBe('Jordan Lee');
	});

	it('returns undefined for missing keys', () => {
		expect(findReviewField([makeField()], undefined)).toBeUndefined();
		expect(findReviewField([makeField()], 'nope')).toBeUndefined();
		expect(findReviewField([makeField()], 'statement_period.child')).toBeUndefined();
	});
});

describe('boxesForPage', () => {
	it('returns fields located on the requested page', () => {
		const fields: ReviewField[] = [
			makeField({ key: 'a', location: { page: 1, area: AREA } }),
			makeField({ key: 'b', location: { page: 2, area: AREA } }),
			makeField({ key: 'c' })
		];

		const pageOne = boxesForPage(fields, 1);
		expect(pageOne.map((box) => box.field.key)).toEqual(['a']);
		expect(pageOne[0]?.location.page).toBe(1);

		expect(boxesForPage(fields, 2).map((box) => box.field.key)).toEqual(['b']);
		expect(boxesForPage(fields, 3)).toEqual([]);
	});

	it('uses the resolver for fields without inline locations', () => {
		const fields = [makeField({ key: 'a' })];
		const pageTwo = boxesForPage(fields, 2, () => ({ page: 2, area: AREA }));
		expect(pageTwo.map((box) => box.field.key)).toEqual(['a']);
		expect(boxesForPage(fields, 1, () => ({ page: 2, area: AREA }))).toEqual([]);
	});
});
