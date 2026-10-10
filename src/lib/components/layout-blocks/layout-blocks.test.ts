// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
// Tests for the layout-blocks helpers, ported from
// apps/v4/components/extend/layout-blocks.tsx.
import { describe, expect, it } from 'vitest';
import {
	blockToArea,
	blockToHighlightArea,
	getOcrBlocks,
	renderBlockMarkdown,
	type OcrBlock,
	type ParsedOcrBlock,
	type ParsedOcrOutput
} from './layout-blocks.js';

function parsedBlock(overrides: Partial<ParsedOcrBlock> = {}): ParsedOcrBlock {
	return {
		id: 'block_1',
		type: 'text',
		content: 'Hello world',
		metadata: {
			page: { number: 1, width: 1275, height: 1651 },
			layoutClass: 'Text',
			minOcrConfidence: 0.9,
			avgOcrConfidence: 0.95
		},
		...overrides
	};
}

function parsedOutput(blocks: ParsedOcrBlock[]): ParsedOcrOutput {
	return { chunks: [{ blocks }] };
}

function ocrBlock(overrides: Partial<OcrBlock> = {}): OcrBlock {
	return {
		id: 'block_1',
		type: 'paragraph',
		text: 'Hello world',
		page: 1,
		pageWidth: 1275,
		pageHeight: 1651,
		confidence: 0.95,
		boundingBox: { left: 100, top: 200, right: 300, bottom: 400 },
		...overrides
	};
}

describe('getOcrBlocks', () => {
	it('maps raw OCR types to layout block types', () => {
		const cases: Array<[string, string | undefined, string?]> = [
			['heading', 'heading'],
			['section_heading', 'heading'],
			['text', 'paragraph'],
			['table', 'table'],
			['figure', 'figure'],
			['image', 'figure'],
			['header', 'header'],
			['footer', 'footer'],
			['page_number', 'page_number'],
			['text', 'list', 'List Item'],
			['unknown', undefined]
		];

		for (const [type, expected, layoutClass] of cases) {
			const blocks = getOcrBlocks(
				parsedOutput([
					parsedBlock({
						id: `block-${type}-${layoutClass ?? 'none'}`,
						type,
						metadata: {
							page: { number: 1, width: 100, height: 100 },
							layoutClass: layoutClass ?? 'Text'
						}
					})
				])
			);
			if (expected === undefined) {
				expect(blocks).toHaveLength(0);
			} else {
				expect(blocks).toHaveLength(1);
				expect(blocks[0]?.type).toBe(expected);
			}
		}
	});

	it('flattens chunks and carries page metadata and geometry', () => {
		const polygon = [
			{ x: 10, y: 20 },
			{ x: 30, y: 20 },
			{ x: 30, y: 40 },
			{ x: 10, y: 40 }
		];
		const boundingBox = { left: 10, top: 20, right: 30, bottom: 40 };
		const output: ParsedOcrOutput = {
			chunks: [
				{ blocks: [parsedBlock({ id: 'a', type: 'heading', content: '# Title' })] },
				{
					blocks: [
						parsedBlock({
							id: 'b',
							type: 'text',
							content: 'Body',
							metadata: {
								page: { number: 2, width: 100, height: 200 },
								layoutClass: 'Text',
								avgOcrConfidence: 0.8
							},
							polygon,
							boundingBox
						})
					]
				}
			]
		};

		const blocks = getOcrBlocks(output);

		expect(blocks).toHaveLength(2);
		expect(blocks[0]).toMatchObject({
			id: 'a',
			type: 'heading',
			text: '# Title',
			page: 1,
			pageWidth: 1275,
			pageHeight: 1651,
			confidence: 0.95
		});
		expect(blocks[1]).toMatchObject({
			id: 'b',
			type: 'paragraph',
			page: 2,
			pageWidth: 100,
			pageHeight: 200,
			confidence: 0.8,
			polygon,
			boundingBox
		});
	});

	it('falls back from average to minimum confidence and then to 1', () => {
		const withoutAvg = getOcrBlocks(
			parsedOutput([
				parsedBlock({
					metadata: {
						page: { number: 1, width: 100, height: 100 },
						minOcrConfidence: 0.7
					}
				})
			])
		);
		expect(withoutAvg[0]?.confidence).toBe(0.7);

		const withoutAny = getOcrBlocks(
			parsedOutput([
				parsedBlock({ metadata: { page: { number: 1, width: 100, height: 100 } } })
			])
		);
		expect(withoutAny[0]?.confidence).toBe(1);
	});

	it('drops blocks whose page dimensions are not positive', () => {
		const blocks = getOcrBlocks(
			parsedOutput([
				parsedBlock({
					id: 'bad',
					metadata: { page: { number: 1, width: 0, height: 100 } }
				}),
				parsedBlock({ id: 'good' })
			])
		);

		expect(blocks.map((block) => block.id)).toEqual(['good']);
	});
});

describe('blockToHighlightArea', () => {
	it('converts a bounding box to page percentages', () => {
		const area = blockToHighlightArea(
			ocrBlock({
				pageWidth: 1000,
				pageHeight: 2000,
				boundingBox: { left: 100, top: 200, right: 300, bottom: 600 }
			})
		);

		expect(area).toEqual({ left: 10, top: 10, width: 20, height: 20 });
	});

	it('derives the box from the polygon when no bounding box is given', () => {
		const area = blockToHighlightArea(
			ocrBlock({
				pageWidth: 100,
				pageHeight: 100,
				boundingBox: undefined,
				polygon: [
					{ x: 10, y: 20 },
					{ x: 30, y: 50 }
				]
			})
		);

		expect(area).toEqual({ left: 10, top: 20, width: 20, height: 30 });
	});

	it('rotates landscape block coordinates against a portrait page', () => {
		const area = blockToHighlightArea(
			ocrBlock({
				pageWidth: 200,
				pageHeight: 100,
				boundingBox: { left: 20, top: 10, right: 60, bottom: 30 }
			}),
			{ width: 100, height: 200 }
		);

		// Unrotated: left 10, top 10, width 20, height 20. Rotation 1 swaps axes.
		expect(area).toEqual({ left: 10, top: 70, width: 20, height: 20 });
	});

	it('leaves portrait blocks on portrait pages unrotated', () => {
		const area = blockToHighlightArea(
			ocrBlock({
				pageWidth: 100,
				pageHeight: 200,
				boundingBox: { left: 10, top: 20, right: 30, bottom: 60 }
			}),
			{ width: 100, height: 200 }
		);

		expect(area).toEqual({ left: 10, top: 10, width: 20, height: 20 });
	});
});

describe('blockToArea', () => {
	it('returns a CSS style string with percentage geometry', () => {
		const style = blockToArea(
			ocrBlock({
				pageWidth: 1000,
				pageHeight: 2000,
				boundingBox: { left: 100, top: 200, right: 300, bottom: 600 }
			})
		);

		expect(style).toContain('left:10%');
		expect(style).toContain('top:10%');
		expect(style).toContain('width:20%');
		expect(style).toContain('height:20%');
	});
});

describe('renderBlockMarkdown', () => {
	it('renders headings, emphasis, and lists', () => {
		const html = renderBlockMarkdown('# Title\n\nSome **bold** text\n\n- one\n- two');

		expect(html).toContain('<h1');
		expect(html).toContain('Title');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<li>one</li>');
	});

	it('renders GFM tables', () => {
		const html = renderBlockMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');

		expect(html).toContain('<table');
		expect(html).toContain('<td>1</td>');
	});

	it('converts caption tags to figcaptions', () => {
		const html = renderBlockMarkdown('<figure>Plot<caption>Figure 1</caption></figure>');

		expect(html).not.toMatch(/<\/?caption>/i);
		expect(html).toContain('<figcaption>');
	});

	it('strips scripts and event-handler attributes', () => {
		const html = renderBlockMarkdown(
			'Hello<script>alert(1)</scr' + 'ipt>\n\n<img src="x" onerror="alert(1)">'
		);

		expect(html).not.toContain('<script');
		expect(html).not.toContain('onerror');
		expect(html).toContain('Hello');
	});

	it('returns an empty string for empty input', () => {
		expect(renderBlockMarkdown('')).toBe('');
	});
});
