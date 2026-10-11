<!--
	MIT License — Svelte 5 port of Extend UI bounding-box-citations. Upstream: extend-hq/ui (MIT).
	Port of upstream JsonCodeView: read-only, line-numbered JSON with token
	colors. Lines are windowed with the shared virtual-list math (upstream
	virtualizes through @pierre/diffs). `isDark` replaces upstream `theme`.
-->
<script lang="ts">
	import { computeWindow } from '../../virtual-list/window.js';
	import type { JsonValue } from './citations.js';
	import { formatJson, tokenizeJsonLine } from './review.js';

	let {
		name = 'actual.json',
		value,
		isDark = false,
		onIsDarkChange: _onIsDarkChange
	}: {
		/** File name, kept for upstream parity (the file header is hidden). */
		name?: string;
		value: JsonValue;
		/** Parent-controlled dark mode flag. */
		isDark?: boolean;
		/** Accepted for contract parity; this view renders no theme control. */
		onIsDarkChange?: (isDark: boolean) => void;
	} = $props();

	const LINE_HEIGHT = 20.8;
	const lines = $derived(formatJson(value).split('\n'));
	let scrollTop = $state(0);
	let viewportHeight = $state(0);
	let viewport: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!viewport || typeof ResizeObserver === 'undefined') return;
		const element = viewport;
		const observer = new ResizeObserver(() => (viewportHeight = element.clientHeight));
		observer.observe(element);
		return () => observer.disconnect();
	});
	const range = $derived(
		computeWindow({
			itemCount: lines.length,
			itemHeight: LINE_HEIGHT,
			// Before layout (or in jsdom) assume a panel-sized viewport.
			viewportHeight: viewportHeight || 480,
			scrollTop
		})
	);
	const visible = $derived(
		Array.from({ length: range.end - range.start }, (_, offset) => range.start + offset)
	);
</script>

<div
	class={`json-code${isDark ? ' dark' : ''}`}
	data-testid="json-code"
	data-file-name={name}
	bind:this={viewport}
	onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
>
	<div class="code-spacer" style={`height: ${lines.length * LINE_HEIGHT}px;`}>
		{#each visible as index (index)}
			<div class="code-line" style={`top: ${index * LINE_HEIGHT}px;`}>
				<span class="code-ln">{index + 1}</span>
				<span class="code-text"
					>{#each tokenizeJsonLine(lines[index]) as token, tokenIndex (tokenIndex)}<span
							class={`tok-${token.kind}`}>{token.text}</span
						>{/each}</span
				>
			</div>
		{/each}
	</div>
</div>

<style>
	.json-code {
		--code-bg: #fafafa;
		--code-fg: #24292f;
		--code-muted: #8c959f;
		--tok-key: #0550ae;
		--tok-string: #0a3069;
		--tok-number: #953800;
		--tok-literal: #8250df;
		--tok-punctuation: #6e7781;
		position: relative;
		height: 100%;
		overflow: auto;
		background: var(--code-bg);
		color: var(--code-fg);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12.8px;
		line-height: 20.8px;
	}

	.json-code.dark {
		--code-bg: #171717;
		--code-fg: #e6edf3;
		--code-muted: #6e7681;
		--tok-key: #79c0ff;
		--tok-string: #a5d6ff;
		--tok-number: #ffa657;
		--tok-literal: #d2a8ff;
		--tok-punctuation: #8b949e;
	}

	.code-spacer {
		position: relative;
		min-width: 100%;
	}

	.code-line {
		position: absolute;
		left: 0;
		display: flex;
		height: 20.8px;
		white-space: pre;
	}

	.code-ln {
		width: 2.75rem;
		flex: none;
		padding-right: 0.75rem;
		color: var(--code-muted);
		text-align: right;
		user-select: none;
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
