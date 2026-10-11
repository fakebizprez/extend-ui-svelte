<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Port of upstream JsonDiffView: split diff of actual.json against
	expected.json with change bars, wrapped lines, and collapsed unchanged
	runs ("N unmodified lines") you can expand. A small line diff replaces
	@pierre/diffs; `isDark` replaces upstream `theme`.
-->
<script lang="ts">
	import type { JsonObject } from './citations.js';
	import { buildSplitDiff, formatJson, tokenizeJsonLine, type DiffRow, type DiffSide } from './review.js';

	let {
		actual,
		expected,
		isDark = false,
		onIsDarkChange: _onIsDarkChange
	}: {
		actual: JsonObject;
		expected: JsonObject;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Accepted for contract parity; this view renders no theme control. */
		onIsDarkChange?: (isDark: boolean) => void;
	} = $props();

	const rows = $derived(buildSplitDiff(formatJson(actual), formatJson(expected)));
	// Keyed by row object, so a recomputed diff starts collapsed again.
	let expanded: Set<DiffRow> = $state.raw(new Set());
</script>

{#snippet side(line: DiffSide | undefined)}
	{#if line}
		<div class="diff-cell" data-kind={line.kind}>
			<span class="diff-ln">{line.lineNumber}</span>
			<span class="diff-code"
				>{#each tokenizeJsonLine(line.text) as token, index (index)}<span class={`tok-${token.kind}`}
						>{token.text}</span
					>{/each}</span
			>
		</div>
	{:else}
		<div class="diff-cell empty"></div>
	{/if}
{/snippet}

<div class={`json-diff${isDark ? ' dark' : ''}`} data-testid="json-diff">
	{#each rows as row, index (index)}
		{#if row.type === 'collapsed' && !expanded.has(row)}
			<button
				type="button"
				class="diff-sep"
				onclick={() => (expanded = new Set(expanded).add(row))}
			>
				{row.count} unmodified lines
			</button>
		{:else}
			{#each row.type === 'collapsed' ? row.rows : [row] as line, lineIndex (lineIndex)}
				<div class="diff-row">
					{@render side(line.left)}
					{@render side(line.right)}
				</div>
			{/each}
		{/if}
	{/each}
</div>

<style>
	.json-diff {
		--diff-bg: rgb(250 250 250 / 0.6);
		--diff-fg: #24292f;
		--diff-muted: #8c959f;
		--diff-border: #e5e5e5;
		--diff-removed-bg: rgb(255 235 233);
		--diff-removed-bar: #e5534b;
		--diff-added-bg: rgb(230 255 236);
		--diff-added-bar: #2da44e;
		--diff-sep-bg: #f3f4f6;
		--tok-key: #0550ae;
		--tok-string: #0a3069;
		--tok-number: #953800;
		--tok-literal: #8250df;
		--tok-punctuation: #6e7781;
		height: 100%;
		overflow: auto;
		background: var(--diff-bg);
		color: var(--diff-fg);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12.8px;
		line-height: 1.625;
	}

	.json-diff.dark {
		--diff-bg: rgb(23 23 23 / 0.6);
		--diff-fg: #e6edf3;
		--diff-muted: #6e7681;
		--diff-border: #262626;
		--diff-removed-bg: rgb(248 81 73 / 0.15);
		--diff-removed-bar: #f85149;
		--diff-added-bg: rgb(46 160 67 / 0.15);
		--diff-added-bar: #3fb950;
		--diff-sep-bg: #1f1f1f;
		--tok-key: #79c0ff;
		--tok-string: #a5d6ff;
		--tok-number: #ffa657;
		--tok-literal: #d2a8ff;
		--tok-punctuation: #8b949e;
	}

	.diff-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		/* Offscreen rows skip layout and paint, so long outputs stay cheap. */
		content-visibility: auto;
		contain-intrinsic-size: auto 21px;
	}

	.diff-cell {
		display: flex;
		min-width: 0;
		border-left: 3px solid transparent;
	}

	.diff-cell + .diff-cell {
		border-right: none;
		box-shadow: inset 1px 0 0 var(--diff-border);
	}

	.diff-cell[data-kind='removed'] {
		border-left-color: var(--diff-removed-bar);
		background: var(--diff-removed-bg);
	}

	.diff-cell[data-kind='added'] {
		border-left-color: var(--diff-added-bar);
		background: var(--diff-added-bg);
	}

	.diff-ln {
		width: 2.75rem;
		flex: none;
		padding-right: 0.75rem;
		color: var(--diff-muted);
		text-align: right;
		user-select: none;
	}

	.diff-code {
		min-width: 0;
		flex: 1;
		padding-right: 0.5rem;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

	.diff-sep {
		display: block;
		width: 100%;
		border: none;
		border-block: 1px solid var(--diff-border);
		background: var(--diff-sep-bg);
		padding: 0.125rem 0.75rem;
		color: var(--diff-muted);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.diff-sep:hover {
		color: var(--diff-fg);
	}

	.tok-key {
		color: var(--tok-key);
	}

	.tok-string {
		color: var(--tok-string);
	}

	.tok-number {
		color: var(--tok-number);
	}

	.tok-literal {
		color: var(--tok-literal);
	}

	.tok-punctuation {
		color: var(--tok-punctuation);
	}
</style>
