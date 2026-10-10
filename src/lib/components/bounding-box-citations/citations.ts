// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).

/**
 * Framework-free citation model ported from the upstream React
 * `bounding-box-citations` component. Locations use percentage coordinates
 * (`left`/`top`/`width`/`height` in 0-100) so overlays scale with the page.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type SchemaPropertyType =
	| 'string'
	| 'number'
	| 'integer'
	| 'boolean'
	| 'object'
	| 'array';

export interface ReviewFieldSchema {
	type: SchemaPropertyType;
	title?: string;
	description?: string;
	enum?: Array<string | number>;
	properties?: Record<string, ReviewFieldSchema>;
	items?: ReviewFieldSchema;
}

export interface HighlightArea {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface ReviewField {
	key: string;
	schema: ReviewFieldSchema;
	actual: JsonValue;
	expected: JsonValue;
	location?: ReviewLocation;
	metadataPath?: string;
}

export interface ReviewLocation {
	page: number;
	area: HighlightArea;
}

export interface ReviewCitation {
	page: number;
	polygon?: Array<{ x: number; y: number }>;
	pageWidth: number;
	pageHeight: number;
}

export interface ReviewMetadataEntry {
	citations?: ReviewCitation[];
}

/** One overlay box: the field plus its resolved page location. */
export interface CitationBox {
	field: ReviewField;
	location: ReviewLocation;
}

function isJsonObject(value: JsonValue): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getObjectValue(value: JsonValue, key: string): JsonValue {
	if (!isJsonObject(value)) return null;
	return value[key] ?? null;
}

/**
 * Converts a cited polygon in page points to a percentage highlight area.
 * Matches the upstream `getCitationLocation` helper.
 */
export function getCitationLocation(citation: ReviewCitation): ReviewLocation | undefined {
	const polygon = citation.polygon;
	if (!polygon?.length || !citation.pageWidth || !citation.pageHeight) {
		return undefined;
	}

	const xs = polygon.map((point) => point.x);
	const ys = polygon.map((point) => point.y);
	const left = Math.min(...xs);
	const top = Math.min(...ys);
	const right = Math.max(...xs);
	const bottom = Math.max(...ys);

	return {
		page: citation.page,
		area: {
			left: (left / citation.pageWidth) * 100,
			top: (top / citation.pageHeight) * 100,
			width: ((right - left) / citation.pageWidth) * 100,
			height: ((bottom - top) / citation.pageHeight) * 100
		}
	};
}

/**
 * Resolves the first cited polygon for a metadata path.
 * Matches the upstream `getMetadataLocation` helper.
 */
export function getMetadataLocation(
	metadata: Record<string, ReviewMetadataEntry> | undefined,
	metadataPath: string | undefined
): ReviewLocation | undefined {
	if (!metadata || !metadataPath) return undefined;

	const citation = metadata[metadataPath]?.citations?.find(
		(candidate) => candidate.polygon?.length
	);

	return citation ? getCitationLocation(citation) : undefined;
}

/**
 * Resolves a field's highlight location: the inline `location` first, then
 * the optional resolver (keyed by `metadataPath`, falling back to `key`).
 * Matches the upstream `getReviewFieldLocation` helper.
 */
export function getReviewFieldLocation(
	field: ReviewField | undefined,
	resolveLocation?: (metadataPath: string) => ReviewLocation | undefined
): ReviewLocation | undefined {
	if (!field) return undefined;

	return (
		field.location ?? resolveLocation?.(field.metadataPath ?? field.key) ?? undefined
	);
}

/** Stable key for a highlight location. Matches upstream `getReviewLocationKey`. */
export function getReviewLocationKey(location: ReviewLocation | undefined): string | null {
	if (!location) return null;

	const { area } = location;
	return [location.page, area.left, area.top, area.width, area.height].join(':');
}

/**
 * Finds a field by key, descending into `object` children with dotted keys
 * (`account.holder`). Matches the upstream `findReviewField` helper.
 */
export function findReviewField(
	fields: ReviewField[],
	fieldKey: string | undefined
): ReviewField | undefined {
	if (!fieldKey) return undefined;

	for (const field of fields) {
		if (field.key === fieldKey) return field;

		if (field.schema.type === 'object') {
			const childFields = Object.entries(field.schema.properties ?? {}).map(
				([key, schema]): ReviewField => ({
					key: `${field.key}.${key}`,
					schema,
					actual: getObjectValue(field.actual, key),
					expected: getObjectValue(field.expected, key),
					metadataPath: `${field.metadataPath ?? field.key}.${key}`
				})
			);
			const childField = findReviewField(childFields, fieldKey);
			if (childField) return childField;
		}
	}

	return undefined;
}

/**
 * Returns the overlay boxes located on one page: every field whose resolved
 * location matches `pageNumber`, in field order.
 */
export function boxesForPage(
	fields: ReviewField[],
	pageNumber: number,
	resolveLocation?: (metadataPath: string) => ReviewLocation | undefined
): CitationBox[] {
	const boxes: CitationBox[] = [];
	for (const field of fields) {
		const location = getReviewFieldLocation(field, resolveLocation);
		if (location?.page === pageNumber) {
			boxes.push({ field, location });
		}
	}
	return boxes;
}

/** Short display value for the citation list. Matches upstream `formatValue`. */
export function formatCitationValue(value: JsonValue): string {
	if (value === null) return 'NULL';
	if (typeof value === 'object') return JSON.stringify(value, null, 2);
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	return String(value);
}
