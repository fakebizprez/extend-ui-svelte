<!--
	MIT License — Svelte 5 port of Extend UI pptx-viewer. Upstream: extend-hq/ui (MIT).
	Single slide canvas: renders one deck slide through the pptx-browser engine
	wrapper. Only the visible window is mounted, by the parent through the
	shared VirtualList, so large decks never render all at once.
-->
<script lang="ts">
	import type { PptxDeck } from '../../engines/pptx/index.js';

	interface Props {
		/** Loaded deck; rendering runs on the client only. */
		deck: PptxDeck;
		/** Zero-based slide index to render. */
		index: number;
		/** Total slides in the deck, for the caption. */
		slideCount: number;
		/** Render width in pixels; height follows the slide aspect ratio. */
		width?: number;
	}

	let { deck, index, slideCount, width = 960 }: Props = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let error = $state<string | null>(null);

	// $effect never runs on the server, so canvas rendering stays client-only.
	$effect(() => {
		const target = canvas;
		if (!target) return;
		let cancelled = false;
		error = null;
		deck.renderSlide(index, target, width).then(
			() => {},
			(failure: unknown) => {
				if (cancelled) return;
				error = failure instanceof Error ? failure.message : 'Could not render slide.';
			}
		);
		return () => {
			cancelled = true;
		};
	});
</script>

<figure class="pptx-slide">
	<canvas
		bind:this={canvas}
		class="pptx-slide-canvas"
		data-testid="slide-canvas"
		data-slide-index={index}
	></canvas>
	{#if error}
		<p class="pptx-slide-error" role="alert">{error}</p>
	{/if}
	<figcaption class="pptx-slide-caption">Slide {index + 1} of {slideCount}</figcaption>
</figure>

<style>
	.pptx-slide {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		height: 100%;
		margin: 0;
		padding: 0.5rem 0.75rem;
		box-sizing: border-box;
	}

	.pptx-slide-canvas {
		flex: 1;
		min-height: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #ffffff;
		border: 1px solid var(--pptx-border, #e5e5e5);
		border-radius: 0.5rem;
	}

	.pptx-slide-caption {
		flex: none;
		text-align: center;
		font-size: 12px;
		color: var(--pptx-muted, #525252);
	}

	.pptx-slide-error {
		flex: none;
		margin: 0;
		text-align: center;
		font-size: 12px;
		color: #b91c1c;
	}
</style>
