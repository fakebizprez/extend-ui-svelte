<!-- MIT License — Svelte 5 port of Extend UI. Upstream: extend-hq/ui (MIT). -->
<!-- Test harness for the PDF engine wrapper. Not part of the public docs. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { PdfEngine } from '#lib/engines/pdf/index.js';

	let canvas: HTMLCanvasElement | undefined = $state();
	let status = $state('loading');
	let pageCount = $state(0);
	let currentPage = $state(0);
	let pageSizes = $state('');
	let error = $state('');

	let engine: PdfEngine | null = null;
	let unsubscribe: (() => void) | null = null;

	async function render(page: number): Promise<void> {
		if (!engine || !canvas) return;
		try {
			await engine.renderPage(page, canvas, { scale: 1 });
			status = 'ready';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			status = 'error';
		}
	}

	function prev(): void {
		if (!engine) return;
		engine.setCurrentPage(engine.currentPage - 1);
	}

	function next(): void {
		if (!engine) return;
		engine.setCurrentPage(engine.currentPage + 1);
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			// Browser-only: the engine (and PDF.js behind it) loads on the client.
			const { createPdfEngine } = await import('#lib/engines/pdf/index.js');
			if (cancelled) return;
			engine = createPdfEngine();
			unsubscribe = engine.onPageChange((page) => {
				currentPage = page;
				void render(page);
			});
			try {
				pageCount = await engine.load('/fixtures/sample.pdf');
				currentPage = engine.currentPage;
				const sizes = await engine.getPageSizes();
				pageSizes = sizes.map((size) => `${size.width}x${size.height}`).join(', ');
				if (!cancelled) {
					await render(engine.currentPage);
				}
			} catch (err) {
				if (!cancelled) {
					error = err instanceof Error ? err.message : String(err);
					status = 'error';
				}
			}
		})();
		return () => {
			cancelled = true;
			unsubscribe?.();
			unsubscribe = null;
			const e = engine;
			engine = null;
			void e?.destroy();
		};
	});
</script>

<h1>PDF Engine Harness</h1>
<p data-testid="pdf-status">Status: {status}</p>
<p data-testid="pdf-page-count">Pages: {pageCount}</p>
<p data-testid="pdf-page-sizes">Page sizes: {pageSizes}</p>
<p data-testid="pdf-current-page">Current page: {currentPage}</p>
{#if error}
	<p data-testid="pdf-error">{error}</p>
{/if}
<div>
	<button type="button" data-testid="pdf-prev" onclick={prev}>Previous</button>
	<button type="button" data-testid="pdf-next" onclick={next}>Next</button>
</div>
<canvas data-testid="pdf-canvas" bind:this={canvas}></canvas>
<p><a href="/">Back to overview</a></p>
