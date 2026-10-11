<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/layout-blocks.tsx (OcrBlocksPanel).

	Deliberate changes from the React version:
	- Virtualization uses the shared VirtualList in measured mode instead of
	  @tanstack/react-virtual: rows start at upstream's per-block size
	  estimate and then size to their content (ResizeObserver).
	- Adds `height` (viewport px, default 420 like upstream's h-[420px]) and
	  `overscan` (default 6 like upstream) props.
	- Exported as LayoutBlocks and as the upstream name OcrBlocksPanel. Not
	  ported: the sample data ATTENTION_OCR_OUTPUT and PDF_URL, the OcrBlocks
	  demo built on them, and OcrBlockOverlay (overlays on the rendered PDF
	  page); blockToArea/blockToHighlightArea are exported for that.
	- Port-only exports: DEFAULT_LAYOUT_BLOCKS_HEIGHT/_OVERSCAN,
	  estimateOcrBlockRowHeight, OCR_BLOCK_TYPE_LABELS, renderBlockMarkdown,
	  and a default export (listed under Differences on the docs page).
	- blockToArea returns a CSS string instead of a React style object.
	- Block markdown is sanitized with hast-util-sanitize (the library behind
	  upstream's rehype-sanitize) and upstream's schema; see sanitizeBlockHtml.
	- `class` is accepted alongside `className`; both merge onto the root.
	- Markdown renders with marked instead of react-markdown; see
	  renderBlockMarkdown in layout-blocks.ts.
	- Type badges are text pills in scoped CSS instead of Hugeicons glyphs.
	- Click also focuses a block (upstream only handles hover and focus) so
	  the panel works on touch and in tests without hover.
	- Dark mode follows the repo-wide contract (isDark + onIsDarkChange).
	  onIsDarkChange is accepted for parity but never invoked: the panel
	  renders no theme switcher of its own.
-->
<script lang="ts">
	import { VirtualList } from '../../virtual-list/index.js';
	import type { DarkModeProps } from '../../dark-mode.js';
	import {
		DEFAULT_LAYOUT_BLOCKS_HEIGHT,
		DEFAULT_LAYOUT_BLOCKS_OVERSCAN,
		estimateOcrBlockRowHeight,
		OCR_BLOCK_TYPE_LABELS,
		renderBlockMarkdown,
		type OcrBlock
	} from './layout-blocks.js';

	interface Props extends DarkModeProps {
		/** Layout blocks to render. */
		blocks: OcrBlock[];
		/** Controlled focused block id. Defaults to the first block. */
		activeBlockId?: string;
		/** Called when the user focuses a different block. */
		onBlockFocus?: (block: OcrBlock) => void;
		class?: string;
		className?: string;
		/** Visible height of the scroll viewport in pixels. Defaults to 420. */
		height?: number;
		/** Extra rows rendered above and below the viewport. Defaults to 6. */
		overscan?: number;
	}

	let {
		blocks,
		activeBlockId,
		onBlockFocus,
		class: classProp,
		className,
		height = DEFAULT_LAYOUT_BLOCKS_HEIGHT,
		overscan = DEFAULT_LAYOUT_BLOCKS_OVERSCAN,
		isDark = false
	}: Props = $props();

	// Upstream: useState(activeBlockId ?? blocks[0]?.id). Initial capture is
	// intended, so a controlled block stays active if the parent clears it.
	// svelte-ignore state_referenced_locally
	let localActiveBlockId = $state<string | undefined>(activeBlockId ?? blocks[0]?.id);

	const firstBlock = $derived(blocks[0]);
	const focusedBlockId = $derived(activeBlockId ?? localActiveBlockId ?? firstBlock?.id);
	const activeBlock = $derived(
		blocks.find((block) => block.id === focusedBlockId) ?? firstBlock
	);

	// Upstream: when the blocks change and the locally focused block is gone,
	// local focus resets to the new first block.
	$effect.pre(() => {
		if (!firstBlock || activeBlockId) return;
		if (blocks.some((block) => block.id === localActiveBlockId)) return;
		if (localActiveBlockId !== undefined) localActiveBlockId = firstBlock.id;
	});

	// Upstream's focusedBlockIdRef: set at once by focusBlock, so repeat events
	// on a block are ignored even while a controlled parent has not caught up,
	// and re-synced only when the effective focused id changes.
	let focusedBlockIdRef: string | undefined;
	$effect.pre(() => {
		focusedBlockIdRef = focusedBlockId;
	});

	function focusBlock(block: OcrBlock): void {
		if (block.id === focusedBlockIdRef) return;
		focusedBlockIdRef = block.id;
		localActiveBlockId = block.id;
		onBlockFocus?.(block);
	}
</script>

<aside
	data-testid="layout-blocks"
	class={['layout-blocks', classProp, className]}
	class:dark={isDark}
>
	{#if blocks.length}
		<VirtualList
			items={blocks}
			estimateSize={(index) => {
				const block = blocks[index];
				return block ? estimateOcrBlockRowHeight(block) : 92;
			}}
			{height}
			{overscan}
		>
			{#snippet children(block, index)}
				{@const isActive = block.id === activeBlock?.id}
				<div
					class="layout-block-row"
					class:first={index === 0}
					class:last={index === blocks.length - 1}
				>
					<button
						type="button"
						class="layout-block"
						class:active={isActive}
						data-testid="layout-block"
						data-block-id={block.id}
						data-block-index={index}
						data-block-type={block.type}
						data-active={isActive}
						onmouseenter={() => focusBlock(block)}
						onfocus={() => focusBlock(block)}
						onclick={() => focusBlock(block)}
					>
						<span class="layout-block-header">
							<span class="layout-block-badge" data-block-type={block.type}>
								{OCR_BLOCK_TYPE_LABELS[block.type]}
							</span>
							<span class="layout-block-confidence">{Math.round(block.confidence * 100)}%</span>
							<span class="layout-block-page">p. {block.page}</span>
						</span>
						<span class="layout-block-body">{@html renderBlockMarkdown(block.text)}</span>
					</button>
				</div>
			{/snippet}
		</VirtualList>
	{:else}
		<div class="layout-blocks-empty" data-testid="layout-blocks-empty">
			No layout blocks found.
		</div>
	{/if}
</aside>

<style>
	.layout-blocks {
		--lb-bg: #ffffff;
		--lb-fg: #111827;
		--lb-muted: #f3f4f6;
		--lb-muted-fg: #6b7280;
		--lb-border: rgba(17, 24, 39, 0.12);
		--lb-row: #ffffff;
		--lb-row-hover: rgba(17, 24, 39, 0.04);
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-radius: 0.5rem;
		border: 1px solid var(--lb-border);
		background: var(--lb-bg);
		color: var(--lb-fg);
	}

	.layout-blocks.dark {
		--lb-bg: #111827;
		--lb-fg: #f3f4f6;
		--lb-muted: #1f2937;
		--lb-muted-fg: #9ca3af;
		--lb-border: rgba(243, 244, 246, 0.16);
		--lb-row: #111827;
		--lb-row-hover: rgba(243, 244, 246, 0.06);
	}

	/* Upstream: rows inset 12px, 8px apart, 12px list padding top and bottom. */
	.layout-block-row {
		padding: 0 0.75rem 0.5rem;
	}

	.layout-block-row.first {
		padding-top: 0.75rem;
	}

	.layout-block-row.last {
		padding-bottom: 1.25rem;
	}

	.layout-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		text-align: left;
		border-radius: 0.5rem;
		border: 1px solid var(--lb-border);
		background: var(--lb-row);
		color: inherit;
		padding: 0.75rem;
		cursor: pointer;
	}

	.layout-block:hover {
		background: var(--lb-row-hover);
	}

	/* Active ring per block type, matching upstream BLOCK_STYLES[type].ring. */
	.layout-block.active {
		--lb-ring: 100, 116, 139;
		border-color: rgba(var(--lb-ring), 0.6);
		background: rgba(var(--lb-ring), 0.05);
	}

	.layout-block.active[data-block-type='heading'] {
		--lb-ring: 139, 92, 246;
	}

	.layout-block.active[data-block-type='paragraph'] {
		--lb-ring: 59, 130, 246;
	}

	.layout-block.active[data-block-type='list'] {
		--lb-ring: 16, 185, 129;
	}

	.layout-block.active[data-block-type='table'] {
		--lb-ring: 245, 158, 11;
	}

	.layout-block.active[data-block-type='figure'] {
		--lb-ring: 244, 63, 94;
	}

	.layout-block.active[data-block-type='header'] {
		--lb-ring: 6, 182, 212;
	}

	.layout-block.active[data-block-type='footer'] {
		--lb-ring: 100, 116, 139;
	}

	.layout-block.active[data-block-type='page_number'] {
		--lb-ring: 113, 113, 122;
	}

	.layout-block:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	.layout-block-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.layout-block-badge {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		background: var(--lb-muted);
		color: var(--lb-muted-fg);
	}

	.layout-block-badge[data-block-type='heading'] {
		background: rgba(139, 92, 246, 0.12);
		color: #7c3aed;
	}

	.layout-block-badge[data-block-type='paragraph'] {
		background: rgba(59, 130, 246, 0.12);
		color: #2563eb;
	}

	.layout-block-badge[data-block-type='list'] {
		background: rgba(16, 185, 129, 0.12);
		color: #059669;
	}

	.layout-block-badge[data-block-type='table'] {
		background: rgba(245, 158, 11, 0.14);
		color: #b45309;
	}

	.layout-block-badge[data-block-type='figure'] {
		background: rgba(244, 63, 94, 0.12);
		color: #e11d48;
	}

	.layout-block-badge[data-block-type='header'] {
		background: rgba(6, 182, 212, 0.12);
		color: #0891b2;
	}

	.layout-block-badge[data-block-type='footer'] {
		background: rgba(100, 116, 139, 0.14);
		color: #475569;
	}

	.layout-block-badge[data-block-type='page_number'] {
		background: rgba(113, 113, 122, 0.14);
		color: #52525b;
	}

	.layout-block-confidence {
		font-size: 0.75rem;
		color: var(--lb-muted-fg);
	}

	.layout-block-page {
		margin-left: auto;
		flex-shrink: 0;
		border-radius: 9999px;
		background: var(--lb-muted);
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		color: var(--lb-muted-fg);
	}

	.layout-block-body {
		display: block;
		overflow: hidden;
		font-size: 0.8125rem;
		line-height: 1.25rem;
	}

	.layout-block-body :global(h1),
	.layout-block-body :global(h2),
	.layout-block-body :global(h3) {
		margin: 0;
		font-size: 1rem;
		line-height: 1.25rem;
		font-weight: 600;
	}

	.layout-block-body :global(p) {
		margin: 0;
	}

	/* Upstream: lists sit flush (my-0) with a pl-4 indent. */
	.layout-block-body :global(ul),
	.layout-block-body :global(ol) {
		margin: 0;
		padding-left: 1rem;
	}

	.layout-block-body :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.layout-block-body :global(th),
	.layout-block-body :global(td) {
		border-top: 1px solid var(--lb-border);
		padding: 0.25rem 0.5rem;
		text-align: left;
	}

	.layout-block-body :global(th) {
		border-bottom: 1px solid var(--lb-border);
		background: var(--lb-muted);
	}

	.layout-block-body :global(figure) {
		margin: 0;
		border-radius: 0.375rem;
		border: 1px solid var(--lb-border);
		padding: 0.5rem;
	}

	.layout-block-body :global(figcaption) {
		display: block;
		border-top: 1px solid var(--lb-border);
		padding-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--lb-muted-fg);
	}

	.layout-blocks-empty {
		margin: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--lb-border);
		background: var(--lb-muted);
		padding: 0.75rem;
		font-size: 0.875rem;
		color: var(--lb-muted-fg);
	}
</style>
