<!--
	MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT).
	Ported from apps/v4/components/extend/layout-blocks.tsx (OcrBlocksPanel).

	Deliberate changes from the React version:
	- Virtualization uses the shared fixed-height VirtualList instead of
	  @tanstack/react-virtual's variable measurement, so rows share one
	  itemHeight and taller content is clipped. Size itemHeight for the
	  longest expected block.
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
	import { VirtualList } from '#lib/virtual-list/index.js';
	import type { DarkModeProps } from '#lib/dark-mode.js';
	import {
		DEFAULT_LAYOUT_BLOCK_ITEM_HEIGHT,
		DEFAULT_LAYOUT_BLOCKS_HEIGHT,
		DEFAULT_LAYOUT_BLOCKS_OVERSCAN,
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
		className?: string;
		/** Visible height of the scroll viewport in pixels. Defaults to 420. */
		height?: number;
		/**
		 * Fixed height of one row in pixels. Defaults to 140. Rows share one
		 * height because virtualization is windowed; taller content is clipped.
		 */
		itemHeight?: number;
		/** Extra rows rendered above and below the viewport. Defaults to 6. */
		overscan?: number;
	}

	let {
		blocks,
		activeBlockId,
		onBlockFocus,
		className,
		height = DEFAULT_LAYOUT_BLOCKS_HEIGHT,
		itemHeight = DEFAULT_LAYOUT_BLOCK_ITEM_HEIGHT,
		overscan = DEFAULT_LAYOUT_BLOCKS_OVERSCAN,
		isDark = false
	}: Props = $props();

	let localActiveBlockId = $state<string | undefined>(undefined);

	const firstBlock = $derived(blocks[0]);
	const focusedBlockId = $derived(activeBlockId ?? localActiveBlockId ?? firstBlock?.id);
	const activeBlock = $derived(
		blocks.find((block) => block.id === focusedBlockId) ?? firstBlock
	);

	function focusBlock(block: OcrBlock): void {
		if (block.id === focusedBlockId) return;
		localActiveBlockId = block.id;
		onBlockFocus?.(block);
	}
</script>

<aside
	data-testid="layout-blocks"
	class="layout-blocks {className ?? ''}"
	class:dark={isDark}
>
	{#if blocks.length}
		<VirtualList items={blocks} {itemHeight} {height} {overscan}>
			{#snippet children(block, index)}
				{@const isActive = block.id === activeBlock?.id}
				<button
					type="button"
					class="layout-block"
					class:active={isActive}
					data-testid="layout-block"
					data-block-id={block.id}
					data-block-index={index}
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

	.layout-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		overflow: hidden;
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

	.layout-block.active {
		border-color: #3b82f6;
		box-shadow: 0 0 0 1px #3b82f6;
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
