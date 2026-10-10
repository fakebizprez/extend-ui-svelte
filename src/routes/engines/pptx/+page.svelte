<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadDeck, type PptxDeck } from '#lib/engines/pptx/index.js';
	import deckUrl from '../../../../tests/fixtures/sample.pptx?url';

	let status = $state('loading');
	let slideCount = $state(0);
	let error = $state('');
	let canvas: HTMLCanvasElement | undefined = $state();

	onMount(() => {
		let cancelled = false;
		let deck: PptxDeck | undefined;

		(async () => {
			try {
				const response = await fetch(deckUrl);
				if (!response.ok) {
					throw new Error(`Fixture request failed: ${response.status}`);
				}
				deck = await loadDeck(new Uint8Array(await response.arrayBuffer()));
				if (cancelled) {
					deck.destroy();
					return;
				}
				slideCount = deck.slideCount;
				if (canvas) {
					await deck.renderSlide(0, canvas);
				}
				if (!cancelled) {
					status = 'ready';
				}
			} catch (err) {
				if (cancelled) return;
				error = err instanceof Error ? err.message : String(err);
				status = 'error';
			}
		})();

		return () => {
			cancelled = true;
			deck?.destroy();
		};
	});
</script>

<h1>PPTX Engine Harness</h1>
<p data-testid="status">{status}</p>
<p>Slides: <span data-testid="slide-count">{slideCount}</span></p>
{#if status === 'error'}
	<p data-testid="error">{error}</p>
{/if}
<canvas data-testid="slide-canvas" bind:this={canvas}></canvas>
