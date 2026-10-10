<!--
	MIT License — Svelte 5 port of Extend UI pdf-viewer. Upstream: extend-hq/ui (MIT).
	Internal single-page renderer: owns one canvas and re-renders it through
	the shared PDF engine whenever the page, scale, or rotation changes.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { PdfEngine, PdfPageSize } from '#lib/engines/pdf/index.js';
	import type { PdfViewerPageOverlayProps } from './types.js';

	interface Props {
		/** Engine instance, or null before it loads on the client. */
		engine: PdfEngine | null;
		/** 1-based page number to render. */
		pageNumber: number;
		/** Render scale (zoom). */
		scale: number;
		/** Rotation in degrees, added to the page's own rotation. */
		rotation: number;
		/** CSS width of the page in pixels. */
		width: number;
		/** CSS height of the page in pixels. */
		height: number;
		/** Extra class for the page wrapper (from `pageClassName`). */
		pageClass?: string;
		/** Overlay snippet rendered on top of the page. */
		overlay?: Snippet<[PdfViewerPageOverlayProps]>;
	}

	let { engine, pageNumber, scale, rotation, width, height, pageClass, overlay }: Props =
		$props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let size = $state.raw<PdfPageSize | null>(null);
	let renderError = $state('');

	$effect(() => {
		const eng = engine;
		const target = canvas;
		const page = pageNumber;
		const pageScale = scale;
		const pageRotation = rotation;
		if (!eng || !target) return;
		let cancelled = false;
		renderError = '';
		eng.renderPage(page, target, { scale: pageScale, rotation: pageRotation }).then(
			(result) => {
				if (cancelled) return;
				size = result;
			},
			(failure: unknown) => {
				if (cancelled) return;
				renderError = failure instanceof Error ? failure.message : 'Could not render page.';
			}
		);
		return () => {
			cancelled = true;
		};
	});

	const overlayProps: PdfViewerPageOverlayProps = $derived({
		pageNumber,
		pageWidth: size?.width ?? width,
		pageHeight: size?.height ?? height,
		scale,
		rotation
	});
</script>

<div
	class={`pdf-page${pageClass ? ` ${pageClass}` : ''}`}
	data-page-number={pageNumber}
	data-rotation={rotation}
	data-testid="pdf-page"
	style={`width: ${width}px; height: ${height}px;`}
>
	<canvas
		bind:this={canvas}
		class="pdf-page-canvas"
		style={`width: ${width}px; height: ${height}px;`}
		aria-label={`Page ${pageNumber}`}
	></canvas>
	{#if renderError}
		<div class="pdf-page-error" role="alert">{renderError}</div>
	{/if}
	{#if overlay}
		<div class="pdf-page-overlay">
			{@render overlay(overlayProps)}
		</div>
	{/if}
</div>

<style>
	.pdf-page {
		position: relative;
		margin: 0 auto;
		background: #ffffff;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.2);
		overflow: hidden;
	}

	.pdf-page-canvas {
		display: block;
	}

	.pdf-page-error {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		text-align: center;
		font-size: 12px;
		color: #b91c1c;
		background: #ffffff;
	}

	.pdf-page-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
</style>
