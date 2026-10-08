// MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
import type { ComponentProps } from 'svelte';
import type LayoutBlocks from './LayoutBlocks.svelte';

export { default as LayoutBlocks } from './LayoutBlocks.svelte';
export { default } from './LayoutBlocks.svelte';
export type LayoutBlocksProps = ComponentProps<typeof LayoutBlocks>;
export {
	blockToArea,
	blockToHighlightArea,
	DEFAULT_LAYOUT_BLOCK_ITEM_HEIGHT,
	DEFAULT_LAYOUT_BLOCKS_HEIGHT,
	DEFAULT_LAYOUT_BLOCKS_OVERSCAN,
	getOcrBlocks,
	OCR_BLOCK_TYPE_LABELS,
	renderBlockMarkdown
} from './layout-blocks.js';
export type {
	BoundingBox,
	HighlightArea,
	OcrBlock,
	OcrBlockType,
	ParsedOcrBlock,
	ParsedOcrOutput,
	Point
} from './layout-blocks.js';
