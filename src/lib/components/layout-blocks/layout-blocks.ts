// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Ported from apps/v4/components/extend/layout-blocks.tsx.
//
// Deliberate changes from the React version:
// - Markdown renders with marked (already a dependency) instead of
//   react-markdown + rehype-sanitize. Raw HTML in block text is sanitized with
//   a small built-in scrubber (script/style tags and event-handler attributes
//   are removed) since no HTML sanitizer dependency is available.
// - blockToArea returns a CSS declaration string for Svelte `style`
//   attributes instead of a React.CSSProperties object.
import { fromHtml } from 'hast-util-from-html';
import { defaultSchema, sanitize, type Schema } from 'hast-util-sanitize';
import { toHtml } from 'hast-util-to-html';
import { marked } from 'marked';

/** A point in page coordinates. */
export type Point = {
	x: number;
	y: number;
};

/** Axis-aligned box in page coordinates. */
export type BoundingBox = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

export type OcrBlockType =
	| 'heading'
	| 'paragraph'
	| 'list'
	| 'table'
	| 'figure'
	| 'header'
	| 'footer'
	| 'page_number';

export type ParsedOcrBlock = {
	id: string;
	type: string;
	content: string;
	metadata: {
		page: {
			number: number;
			width: number;
			height: number;
		};
		layoutClass?: string;
		minOcrConfidence?: number;
		avgOcrConfidence?: number;
	};
	polygon?: Point[];
	boundingBox?: BoundingBox;
};

export type ParsedOcrOutput = {
	chunks: {
		blocks: ParsedOcrBlock[];
	}[];
};

export type OcrBlock = {
	id: string;
	type: OcrBlockType;
	text: string;
	page: number;
	pageWidth: number;
	pageHeight: number;
	confidence: number;
	polygon?: Point[];
	boundingBox?: BoundingBox;
};

/** Highlight geometry as percentages of the page. */
export type HighlightArea = {
	left: number;
	top: number;
	width: number;
	height: number;
};

/** Default viewport height in pixels, matching the upstream h-[420px] panel. */
export const DEFAULT_LAYOUT_BLOCKS_HEIGHT = 420;
/** Default overscan rows above and below the viewport, matching upstream. */
export const DEFAULT_LAYOUT_BLOCKS_OVERSCAN = 6;

/** Human-readable label per block type, matching upstream BLOCK_STYLES. */
export const OCR_BLOCK_TYPE_LABELS: Record<OcrBlockType, string> = {
	heading: 'Heading',
	paragraph: 'Paragraph',
	list: 'List',
	table: 'Table',
	figure: 'Figure',
	header: 'Header',
	footer: 'Footer',
	page_number: 'Page number'
};

const OCR_MARKDOWN_FIGURE_CAPTION_PATTERN = /<\/?caption>/gi;

// Row-size estimate constants, matching upstream layout-blocks.tsx.
const OCR_BLOCK_ROW_MIN_ESTIMATE = 92;
const OCR_BLOCK_ROW_VERTICAL_CHROME = 62;
const OCR_BLOCK_LINE_HEIGHT = 20;
const OCR_BLOCK_ESTIMATED_CHARS_PER_LINE = 42;
const OCR_BLOCK_ROW_GAP = 8;

/**
 * Estimated row height in pixels before the row is measured. Port of
 * upstream getEstimatedOcrBlockRowHeight; the real height replaces it once
 * the row renders.
 */
export function estimateOcrBlockRowHeight(block: OcrBlock): number {
	const plainText = block.text
		.replace(OCR_MARKDOWN_FIGURE_CAPTION_PATTERN, '')
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	const explicitLineCount = block.text.split(/\n+/).filter(Boolean).length;
	const wrappedLineCount = Math.max(
		explicitLineCount,
		Math.ceil(plainText.length / OCR_BLOCK_ESTIMATED_CHARS_PER_LINE)
	);
	const contentHeight = Math.max(1, wrappedLineCount) * OCR_BLOCK_LINE_HEIGHT;
	const typeExtraHeight = block.type === 'figure' ? 44 : block.type === 'table' ? 28 : 0;

	return Math.max(
		OCR_BLOCK_ROW_MIN_ESTIMATE,
		OCR_BLOCK_ROW_VERTICAL_CHROME + contentHeight + typeExtraHeight + OCR_BLOCK_ROW_GAP
	);
}

/** Map a raw OCR block to a layout block type, or undefined to drop it. */
function getBlockType(block: ParsedOcrBlock): OcrBlockType | undefined {
	if (block.type === 'heading' || block.type === 'section_heading') {
		return 'heading';
	}

	if (block.type === 'header') {
		return 'header';
	}

	if (block.type === 'footer') {
		return 'footer';
	}

	if (block.type === 'page_number') {
		return 'page_number';
	}

	if (block.type === 'figure' || block.type === 'image') {
		return 'figure';
	}

	if (block.type === 'table') {
		return 'table';
	}

	if (block.metadata.layoutClass === 'List Item') {
		return 'list';
	}

	if (block.type === 'text') {
		return 'paragraph';
	}
}

/** Flatten parsed OCR chunks into renderable layout blocks. */
export function getOcrBlocks(output: ParsedOcrOutput): OcrBlock[] {
	return output.chunks.flatMap((chunk) =>
		chunk.blocks.flatMap((block) => {
			const type = getBlockType(block);
			const { page } = block.metadata;

			if (!type || page.width <= 0 || page.height <= 0) {
				return [];
			}

			return {
				id: block.id,
				type,
				text: block.content,
				page: page.number,
				pageWidth: page.width,
				pageHeight: page.height,
				confidence:
					block.metadata.avgOcrConfidence ?? block.metadata.minOcrConfidence ?? 1,
				polygon: block.polygon,
				boundingBox: block.boundingBox
			};
		})
	);
}

function getBoundingBox(block: OcrBlock): BoundingBox {
	if (block.boundingBox) {
		return block.boundingBox;
	}

	const polygon = block.polygon ?? [];
	const xValues = polygon.map((point) => point.x);
	const yValues = polygon.map((point) => point.y);
	const left = Math.min(...xValues);
	const right = Math.max(...xValues);
	const top = Math.min(...yValues);
	const bottom = Math.max(...yValues);

	return { left, top, right, bottom };
}

function getBlockCoordinateRotation(
	block: OcrBlock,
	pageSize?: { width: number; height: number }
): number {
	const blockIsLandscape = block.pageWidth > block.pageHeight;

	if (!pageSize) return blockIsLandscape ? 1 : 0;

	const pageIsLandscape = pageSize.width > pageSize.height;

	if (blockIsLandscape && !pageIsLandscape) return 1;
	if (!blockIsLandscape && pageIsLandscape) return 3;

	return 0;
}

function normalizeHighlightAreaForRotation(
	area: HighlightArea,
	rotation: number
): HighlightArea {
	if (rotation === 1) {
		return {
			left: area.top,
			top: 100 - area.left - area.width,
			width: area.height,
			height: area.width
		};
	}

	if (rotation === 3) {
		return {
			left: 100 - area.top - area.height,
			top: area.left,
			width: area.height,
			height: area.width
		};
	}

	return area;
}

/** Convert a block's geometry to percentage-based highlight coordinates. */
export function blockToHighlightArea(
	block: OcrBlock,
	pageSize?: { width: number; height: number }
): HighlightArea {
	const { left, top, right, bottom } = getBoundingBox(block);

	const area = {
		left: (left / block.pageWidth) * 100,
		top: (top / block.pageHeight) * 100,
		width: ((right - left) / block.pageWidth) * 100,
		height: ((bottom - top) / block.pageHeight) * 100
	};

	return normalizeHighlightAreaForRotation(
		area,
		getBlockCoordinateRotation(block, pageSize)
	);
}

/** Convert a block's geometry to a CSS `style` declaration string. */
export function blockToArea(
	block: OcrBlock,
	pageSize?: { width: number; height: number }
): string {
	const area = blockToHighlightArea(block, pageSize);

	return (
		`left:${area.left}%;top:${area.top}%;` +
		`width:${area.width}%;height:${area.height}%;`
	);
}

// Upstream runs react-markdown with rehype-raw and rehype-sanitize; this is
// the same sanitizer (hast-util-sanitize) with upstream's schema: GitHub's
// default schema plus figure (with `type`), figcaption, and caption, keeping
// the default clobber prefix and URL protocols.
const OCR_MARKDOWN_SCHEMA: Schema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		figure: [...(defaultSchema.attributes?.figure ?? []), 'type']
	},
	tagNames: [...(defaultSchema.tagNames ?? []), 'caption', 'figcaption', 'figure']
};

/** Sanitize rendered HTML with upstream's schema. Framework-free, so it runs during SSR. */
export function sanitizeBlockHtml(html: string): string {
	const tree = sanitize(fromHtml(html, { fragment: true }), OCR_MARKDOWN_SCHEMA);
	// Named references (&amp;) match what React writes for upstream.
	return toHtml(tree, { characterReferences: { useNamedReferences: true } });
}

/**
 * Render block markdown to sanitized HTML with marked.
 *
 * `<caption>` tags are rewritten to `<figcaption>` first (matching upstream),
 * then GFM markdown is parsed and the result is sanitized with upstream's
 * rehype-sanitize schema.
 */
export function renderBlockMarkdown(text: string): string {
	if (!text) return '';

	const markdown = text.replace(OCR_MARKDOWN_FIGURE_CAPTION_PATTERN, (tag) =>
		tag.startsWith('</') ? '</figcaption>' : '<figcaption>'
	);

	// Soft line breaks, like upstream react-markdown + remark-gfm.
	const html = marked.parse(markdown, { gfm: true, async: false }) as string;

	return sanitizeBlockHtml(html);
}
