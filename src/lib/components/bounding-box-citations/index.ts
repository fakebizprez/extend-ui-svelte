// MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
export {
	default as BoundingBoxCitations,
	default as HumanReviewBlock,
	type BoundingBoxCitationsProps
} from './BoundingBoxCitations.svelte';
export { default } from './BoundingBoxCitations.svelte';
export { default as HumanReviewPanel, type HumanReviewPanelProps } from './HumanReviewPanel.svelte';
export { default as HumanReviewHighlight } from './HumanReviewHighlight.svelte';
export { default as JsonDiffView } from './JsonDiffView.svelte';
export { default as JsonCodeView } from './JsonCodeView.svelte';
export {
	boxesForPage,
	findReviewField,
	formatCitationValue,
	getCitationLocation,
	getMetadataLocation,
	getReviewFieldLocation,
	getReviewLocationKey,
	type CitationBox,
	type HighlightArea,
	type JsonArray,
	type JsonObject,
	type JsonPrimitive,
	type JsonValue,
	type ReviewCitation,
	type ReviewField,
	type ReviewFieldSchema,
	type ReviewLocation,
	type ReviewMetadataEntry,
	type SchemaPropertyType
} from './citations.js';
export { REVIEW_FIELDS, type ArrayNestedView, type ArrayReviewSide } from './review.js';
